import { describe, expect, it } from "vitest";
import {
  formatClock,
  isRepeatCommand,
  joinTranscript,
  phaseLabel,
  pickVoice,
  splitForSpeech,
  toSpeakableText,
} from "@/lib/voice-call";

describe("toSpeakableText", () => {
  it("removes markdown, links and code so a voice never reads symbols aloud", () => {
    const text = toSpeakableText("## Question\n**Explain** the `reduce` method, see [docs](https://x.dev/a) or https://y.dev now.");
    expect(text).toBe("Question Explain the reduce method, see docs or a link now.");
  });

  it("replaces code blocks with a spoken placeholder", () => {
    expect(toSpeakableText("Look at this:\n```js\nconst a = 1;\n```\nThen answer.")).toBe("Look at this: (code omitted) Then answer.");
  });

  it("strips list markers and collapses whitespace", () => {
    expect(toSpeakableText("- first\n* second\n> quoted\n\n\nthird")).toBe("first second quoted third");
  });

  it("returns an empty string for empty input", () => {
    expect(toSpeakableText("   \n ")).toBe("");
  });
});

describe("splitForSpeech", () => {
  it("keeps a short text in one piece", () => {
    expect(splitForSpeech("Tell me about yourself.")).toEqual(["Tell me about yourself."]);
  });

  it("returns nothing for empty text", () => {
    expect(splitForSpeech("")).toEqual([]);
    expect(splitForSpeech("   ")).toEqual([]);
  });

  it("packs short sentences together up to the limit", () => {
    const chunks = splitForSpeech("One. Two. Three.", 12);
    expect(chunks).toEqual(["One. Two.", "Three."]);
    expect(chunks.join(" ")).toBe("One. Two. Three.");
  });

  it("never produces a piece longer than the limit, even for one huge sentence", () => {
    const sentence = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") + ".";
    const chunks = splitForSpeech(sentence, 100);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(sentence);
  });

  it("prefers to break at commas", () => {
    const chunks = splitForSpeech("First clause with several words in it, second clause with several more words in it.", 60);
    expect(chunks[0].endsWith(",")).toBe(true);
  });

  it("loses no words from a long multi-sentence question", () => {
    const text = "Thanks for that. Now, imagine a service that receives ten thousand requests per second! How would you design its cache? Walk me through your reasoning.";
    const chunks = splitForSpeech(text, 60);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(60);
    expect(chunks.join(" ")).toBe(text);
  });
});

describe("isRepeatCommand", () => {
  it.each([
    "Could you repeat that?",
    "can you please repeat the question",
    "Sorry, could you say that again?",
    "repeat the question",
    "Say that again please",
    "pardon",
    "Come again?",
    "I didn't catch that",
    "What was the question?",
    "um could you repeat the question please",
  ])("treats %j as a request to repeat", (phrase) => {
    expect(isRepeatCommand(phrase)).toBe(true);
  });

  it.each([
    "I would repeat the loop until the list is sorted",
    "You could repeat that experiment with a bigger sample, and then compare the results carefully against the baseline we measured",
    "I think the answer is to use a hash map",
    "",
    "   ",
    "repeat",
  ])("does not treat %j as a command", (phrase) => {
    expect(isRepeatCommand(phrase)).toBe(false);
  });
});

describe("joinTranscript", () => {
  it("joins finished phrases and the phrase still being recognised", () => {
    expect(joinTranscript(["I would use", "a hash map"], "to store")).toBe("I would use a hash map to store");
  });

  it("ignores blanks and tidies whitespace", () => {
    expect(joinTranscript(["  hello  ", "", "world "], "   ")).toBe("hello world");
    expect(joinTranscript([], "")).toBe("");
  });
});

describe("pickVoice", () => {
  const voices = [
    { name: "Plain", lang: "en-US", voiceURI: "plain" },
    { name: "Hindi One", lang: "hi-IN", voiceURI: "hi" },
    { name: "Samantha", lang: "en-US", voiceURI: "sam" },
    { name: "System Default", lang: "en-GB", voiceURI: "def", default: true },
  ];

  it("returns null when there are no voices", () => {
    expect(pickVoice([], null)).toBeNull();
  });

  it("uses the saved voice when it still exists", () => {
    expect(pickVoice(voices, "plain")?.voiceURI).toBe("plain");
  });

  it("ignores a saved voice that is no longer installed", () => {
    expect(pickVoice(voices, "gone")?.voiceURI).toBe("sam");
  });

  it("prefers a good-sounding English voice", () => {
    expect(pickVoice(voices, null)?.voiceURI).toBe("sam");
  });

  it("falls back to the browser default, then the first English voice", () => {
    const plain = [
      { name: "A", lang: "fr-FR", voiceURI: "fr" },
      { name: "B", lang: "en-US", voiceURI: "b" },
      { name: "C", lang: "en-GB", voiceURI: "c", default: true },
    ];
    expect(pickVoice(plain, null)?.voiceURI).toBe("c");
    expect(pickVoice(plain.slice(0, 2), null)?.voiceURI).toBe("b");
  });

  it("still returns something when no voice matches the language", () => {
    expect(pickVoice([{ name: "Solo", lang: "de-DE", voiceURI: "de" }], null, "en")?.voiceURI).toBe("de");
  });
});

describe("formatClock and phaseLabel", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75)).toBe("01:15");
    expect(formatClock(3725)).toBe("62:05");
    expect(formatClock(-4)).toBe("00:00");
    expect(formatClock(9.9)).toBe("00:09");
  });

  it("describes every phase", () => {
    expect(phaseLabel("speaking", false)).toBe("Interviewer is speaking");
    expect(phaseLabel("listening", false)).toBe("Listening");
    expect(phaseLabel("listening", true)).toBe("Your microphone is off");
    expect(phaseLabel("thinking", false)).toMatch(/thinking/i);
    expect(phaseLabel("paused", false)).toBe("Call paused");
    expect(phaseLabel("idle", false)).toBe("");
  });
});
