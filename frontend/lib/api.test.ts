import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";

const SESSION_KEY = "intervu_user";

/** A minimal browser: localStorage with a signed-in session, and a spy for redirects. */
function installBrowser(signedIn = true) {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const assign = vi.fn();
  vi.stubGlobal("window", {
    localStorage,
    location: { pathname: "/dashboard", assign },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("localStorage", localStorage);
  if (signedIn) {
    store.set(
      SESSION_KEY,
      JSON.stringify({
        user_id: 1, name: "Ana", email: "ana@example.com", is_new: false, token_type: "bearer",
        access_token: "tok-123", expires_in: 1000, expires_at: Date.now() + 1_000_000,
      }),
    );
  }
  return { store, assign };
}

/** A fetch Response whose body arrives in exactly the given pieces. */
function sse(pieces: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

const START_BODY = { username: "Ana", company: "Acme", role: "SDE" };
const RESULT = { interview_id: 7, first_question: "Hello", blueprint: { sections: [] }, difficulty: "Medium", degraded: false, warnings: [] };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streaming client", () => {
  it("reassembles events that are split across network chunks", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(
      sse([
        'event: stage\ndata: {"sta',
        'ge":"searching"}\n\nevent: sta',
        'ge\ndata: {"stage":"planning"}',
        "\n",
        `\nevent: result\ndata: ${JSON.stringify(RESULT)}\n\n`,
      ]),
    );
    const stages: string[] = [];

    const result = await api.interviews.startStream(START_BODY, (stage) => stages.push(stage));

    expect(stages).toEqual(["searching", "planning"]);
    expect(result.interview_id).toBe(7);
  });

  it("still delivers a final event that has no trailing blank line", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(sse([`event: result\ndata: ${JSON.stringify(RESULT)}`]));
    expect((await api.interviews.startStream(START_BODY)).first_question).toBe("Hello");
  });

  it("turns an error event into an ApiError carrying the server's status and message", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(sse(['event: error\ndata: {"status":503,"detail":"Services are down"}\n\n']));
    const failure = await api.interviews.startStream(START_BODY).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(503);
    expect(failure.detail).toBe("Services are down");
  });

  it("reports a stream that ends without a result instead of hanging or succeeding", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(sse(['event: stage\ndata: {"stage":"searching"}\n\n']));
    const failure = await api.interviews.startStream(START_BODY).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(0);
    expect(failure.detail).toMatch(/closed before the server finished/);
  });

  it("ignores events without data and malformed JSON", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(
      sse(["event: stage\n\n", "event: stage\ndata: {not json}\n\n", `event: result\ndata: ${JSON.stringify(RESULT)}\n\n`]),
    );
    const onStage = vi.fn();
    expect((await api.interviews.startStream(START_BODY, onStage)).interview_id).toBe(7);
    expect(onStage).not.toHaveBeenCalled();
  });

  it("surfaces plain HTTP errors from before streaming starts", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Still processing" }), { status: 409 }));
    const failure = await api.interviews.submitAnswerStream(1, "hi").catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect([failure.status, failure.detail]).toEqual([409, "Still processing"]);
  });

  it("signs the user out and redirects on 401", async () => {
    const { store, assign } = installBrowser();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid token" }), { status: 401 }));
    await api.interviews.startStream(START_BODY).catch(() => undefined);
    expect(store.has(SESSION_KEY)).toBe(false);
    expect(assign).toHaveBeenCalledWith("/login?expired=1");
  });

  it("does not call the server without a session", async () => {
    const { assign } = installBrowser(false);
    const failure = await api.interviews.startStream(START_BODY).catch((e) => e);
    expect(failure.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/login?expired=1");
  });

  it("reports network failures as status 0", async () => {
    installBrowser();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const failure = await api.interviews.startStream(START_BODY).catch((e) => e);
    expect([failure.status, failure.detail]).toEqual([0, "Network error"]);
  });

  it("sends the bearer token and the request body", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(sse([`event: result\ndata: ${JSON.stringify(RESULT)}\n\n`]));
    await api.interviews.startStream({ ...START_BODY, voice_mode: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/interviews\/start\/stream$/);
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(init.headers.Accept).toBe("text/event-stream");
    expect(JSON.parse(init.body)).toMatchObject({ company: "Acme", voice_mode: true });
  });
});

describe("answer stream voice mode", () => {
  const answerResult = { evaluation: {}, next_question: "Q2", next_section: "S", interview_complete: false, next_acknowledgment: "", report_ready: false };

  async function sentBody(options?: { voiceMode?: boolean }) {
    installBrowser();
    fetchMock.mockResolvedValue(sse([`event: result\ndata: ${JSON.stringify(answerResult)}\n\n`]));
    await api.interviews.submitAnswerStream(5, "my answer", {}, options);
    return JSON.parse(fetchMock.mock.calls[0][1].body);
  }

  it("leaves voice_mode out when it is not specified, so the interview's setting is unchanged", async () => {
    expect(await sentBody()).toEqual({ answer: "my answer" });
  });

  it("sends voice_mode true or false explicitly", async () => {
    expect(await sentBody({ voiceMode: true })).toEqual({ answer: "my answer", voice_mode: true });
    fetchMock.mockClear();
    expect(await sentBody({ voiceMode: false })).toEqual({ answer: "my answer", voice_mode: false });
  });

  it("passes the evaluation to the handler before resolving", async () => {
    installBrowser();
    fetchMock.mockResolvedValue(
      sse([
        'event: stage\ndata: {"stage":"evaluating"}\n\n',
        'event: evaluation\ndata: {"evaluation":{"score":7.5}}\n\n',
        `event: result\ndata: ${JSON.stringify(answerResult)}\n\n`,
      ]),
    );
    const seen: string[] = [];
    await api.interviews.submitAnswerStream(5, "a", {
      onStage: (s) => seen.push(`stage:${s}`),
      onEvaluation: (e) => seen.push(`score:${e.score}`),
    });
    expect(seen).toEqual(["stage:evaluating", "score:7.5"]);
  });
});
