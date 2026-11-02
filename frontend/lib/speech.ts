/**
 * Browser speech helpers (Web Speech API). Everything is opt-in and runs
 * through the browser:
 *  - Text-to-speech (`speechSynthesis`) stays on the device.
 *  - Dictation (`SpeechRecognition`) is performed by the browser's speech
 *    service. In Chrome that means the audio is sent to Google; InterVu never
 *    receives or stores any audio, only the text you choose to submit.
 */

import { pickVoice, splitForSpeech } from "@/lib/voice-call";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => RecognitionLike;


function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupport(): { speak: boolean; dictate: boolean } {
  if (typeof window === "undefined") return { speak: false, dictate: false };
  return { speak: "speechSynthesis" in window, dictate: recognitionCtor() !== null };
}

/**
 * Read `text` aloud, replacing anything still being spoken. Voice is an
 * optional extra: any browser error is swallowed here so it can never break
 * the interview flow that called it.
 */
export function speak(text: string, lang = "en-US"): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const clean = text.replace(/```[\s\S]*?```/g, " code omitted ").replace(/\s+/g, " ").trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Text-to-speech failed:", error);
  }
}

export function stopSpeaking(): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch (error) {
    console.warn("Could not stop speech:", error);
  }
}

export type Dictation = { start: () => void; stop: () => void; abort: () => void };

export function createDictation(handlers: {
  /** `final` is newly finished text to append; `interim` is the in-progress guess. */
  onText: (final: string, interim: string) => void;
  onEnd: () => void;
  onError: (reason: string) => void;
  lang?: string;
}): Dictation | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = handlers.lang ?? "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let finalText = "";
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    handlers.onText(finalText, interim);
  };
  recognition.onerror = (e) => handlers.onError(e.error ?? "unknown");
  recognition.onend = () => handlers.onEnd();
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => {
      // Drop the handlers first so an aborted session cannot report results or "ended" later.
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    },
  };
}

// ── Speaking with real start / end events (used by the voice call) ────────────

export type SpeechOptions = {
  lang?: string;
  /** 0.5 to 2, 1 = normal. */
  rate?: number;
  voiceURI?: string | null;
  onStart?: () => void;
  /** All of the text was spoken (or the voice could not speak it and gave up). */
  onEnd?: () => void;
  /** The speech engine failed; speaking stops. `onEnd` is NOT called after this. */
  onError?: (reason: string) => void;
};

export type SpeechHandle = { cancel: () => void };

/** Voices installed in the browser (may be empty until `voiceschanged` fires). */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

/** Call `callback` when the voice list changes. Returns an unsubscribe function. */
export function onVoicesChanged(callback: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  const synth = window.speechSynthesis;
  try {
    synth.addEventListener("voiceschanged", callback);
  } catch {
    return () => {};
  }
  return () => {
    try {
      synth.removeEventListener("voiceschanged", callback);
    } catch {
      // ignore
    }
  };
}

/**
 * Speak `text` sentence by sentence, reporting when speaking really starts and
 * ends. Each piece also has a watchdog: if a browser never reports the end of
 * an utterance, the call moves on instead of hanging forever.
 */
export function speakText(text: string, options: SpeechOptions = {}): SpeechHandle {
  const chunks = splitForSpeech(text);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  let cancelled = false;
  let finished = false;
  let started = false;
  let index = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (cancelled || finished) return;
    finished = true;
    options.onEnd?.();
  };

  if (!supported || chunks.length === 0) {
    queueMicrotask(finish);
    return { cancel: () => { cancelled = true; } };
  }

  const synth = window.speechSynthesis;

  const next = () => {
    if (cancelled || finished) return;
    clearTimeout(watchdog);
    if (index >= chunks.length) {
      finish();
      return;
    }
    const piece = chunks[index++];
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      clearTimeout(watchdog);
      next();
    };
    try {
      const utterance = new SpeechSynthesisUtterance(piece);
      utterance.lang = options.lang ?? "en-US";
      utterance.rate = options.rate ?? 1;
      const voice = pickVoice(
        listVoices().map((v) => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI, default: v.default, raw: v })),
        options.voiceURI ?? null,
        (options.lang ?? "en-US").slice(0, 2),
      );
      if (voice) utterance.voice = voice.raw;
      utterance.onstart = () => {
        if (!started) {
          started = true;
          options.onStart?.();
        }
      };
      utterance.onend = advance;
      utterance.onerror = (event) => {
        if (cancelled || advanced) return;
        const reason = (event as { error?: string }).error ?? "unknown";
        if (reason === "interrupted" || reason === "canceled") return; // we cancelled it ourselves
        cancelled = true;
        clearTimeout(watchdog);
        options.onError?.(reason);
      };
      // Generous upper bound for this piece; only matters if the browser never says "end".
      const budget = Math.max(4000, piece.length * 130 + 2500) / Math.max(0.5, options.rate ?? 1);
      watchdog = setTimeout(advance, budget);
      synth.speak(utterance);
    } catch (error) {
      cancelled = true;
      options.onError?.(error instanceof Error ? error.message : "speak-failed");
    }
  };

  try {
    synth.cancel(); // clear anything left in the queue
  } catch {
    // ignore
  }
  next();

  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(watchdog);
      try {
        synth.cancel();
      } catch {
        // ignore
      }
    },
  };
}
