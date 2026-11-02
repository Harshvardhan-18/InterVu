/**
 * Pure helpers and constants for the voice call (no React, no browser APIs),
 * so the logic that decides what is said and when can be unit tested.
 */

/** Where a call is in its lifecycle. "idle" means no call (the overlay is closed). */
export type CallPhase = "idle" | "ready" | "speaking" | "listening" | "thinking" | "paused" | "error";

/** What the interview page tells the call after an answer was processed. */
export type AnswerOutcome =
  | { kind: "question"; text: string }
  | { kind: "complete"; text: string }
  | { kind: "error"; message: string };

/** Pause after you stop talking before the answer is sent, in ms. */
export const SILENCE_OPTIONS_MS = [1500, 2500, 4000, 6000] as const;
export const DEFAULT_SILENCE_MS = 2500;

export const RATE_OPTIONS = [0.9, 1, 1.1, 1.25] as const;
export const DEFAULT_RATE = 1;

/** Quiet this long after the question and the interviewer gently encourages you once. */
export const NUDGE_AFTER_MS = 20_000;
export const NUDGE_TEXT = "Take your time. I'm listening.";
/** Quiet this long and the call pauses itself instead of sending nothing. */
export const AUTO_PAUSE_AFTER_MS = 90_000;

/** Closing line spoken before the report opens. */
export const CLOSING_LINE =
  "Thank you, that's everything I wanted to ask. I'm putting your feedback report together now.";

/** Recognition that keeps ending right away is broken; give up after this many restarts... */
export const MAX_RESTARTS = 6;
/** ...within this window. */
export const RESTART_WINDOW_MS = 10_000;

/** Longest piece handed to the speech engine at once (Chrome cuts off long utterances). */
const MAX_CHUNK_CHARS = 180;

/** Plain text a text-to-speech voice should read: no markdown, links or code. */
export function toSpeakableText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/^[\s>*#-]+/gm, "")
    .replace(/[*_~#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split text into pieces of at most ~180 characters, preferring sentence ends,
 * then commas/semicolons, then spaces. Speaking piece by piece avoids Chrome
 * silently stopping in the middle of a long utterance.
 */
export function splitForSpeech(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  const clean = toSpeakableText(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > maxChars) {
      flush();
      let rest = sentence;
      while (rest.length > maxChars) {
        let cut = Math.max(rest.lastIndexOf(", ", maxChars), rest.lastIndexOf("; ", maxChars));
        if (cut < maxChars * 0.4) cut = rest.lastIndexOf(" ", maxChars);
        if (cut <= 0) cut = maxChars;
        chunks.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + 1 + sentence.length > maxChars) flush();
    current = current ? `${current} ${sentence}` : sentence;
  }
  flush();
  return chunks;
}

const REPEAT_PATTERNS: RegExp[] = [
  /^(?:(?:sorry|um|uh|hmm|excuse me|pardon me)\s+)*(?:could|can|would|will)\s+you\s+(?:please\s+)?(?:repeat|say)\s+(?:that|it|the question|the last question|this)(?:\s+again)?(?:\s+please)?$/,
  /^(?:(?:sorry|um|uh|hmm)\s+)*(?:could|can|would|will)\s+you\s+(?:please\s+)?say\s+that\s+again(?:\s+please)?$/,
  /^(?:please\s+)?repeat\s+(?:that|the question|the last question|it|this)(?:\s+please)?$/,
  /^(?:please\s+)?say\s+(?:that|it)\s+again(?:\s+please)?$/,
  /^(?:sorry\s+)?(?:pardon|come again|what was that|what was the question|i didn'?t (?:catch|hear) that|i missed that)(?:\s+please)?$/,
];

/**
 * True when the whole utterance is a request to hear the question again
 * ("could you repeat that?"). Only short, whole-utterance matches count, so a
 * real answer that happens to contain the word "repeat" is never swallowed.
 */
export function isRepeatCommand(utterance: string): boolean {
  const normalized = utterance
    .toLowerCase()
    .replace(/[.,!?;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > 10) return false;
  return REPEAT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** The answer so far: finished phrases plus the phrase still being recognised. */
export function joinTranscript(finals: readonly string[], interim: string): string {
  return [...finals, interim]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VoiceInfo = { name: string; lang: string; voiceURI: string; default?: boolean };

const PREFERRED_VOICE = /natural|neural|premium|enhanced|google|samantha|daniel|karen|serena|aaron|jenny|guy/i;

/**
 * The voice to speak with: the saved choice if it still exists, otherwise a
 * good-sounding English voice, otherwise the browser default.
 */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[], preferredURI: string | null, lang = "en"): T | null {
  if (voices.length === 0) return null;
  if (preferredURI) {
    const saved = voices.find((voice) => voice.voiceURI === preferredURI);
    if (saved) return saved;
  }
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()));
  const pool = matching.length > 0 ? matching : voices;
  return pool.find((voice) => PREFERRED_VOICE.test(voice.name)) ?? pool.find((voice) => voice.default) ?? pool[0];
}

/** 75 -> "01:15" */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** Human label for the call state shown under the orb. */
export function phaseLabel(phase: CallPhase, muted: boolean): string {
  switch (phase) {
    case "ready":
      return "Ready when you are";
    case "speaking":
      return "Interviewer is speaking";
    case "listening":
      return muted ? "Your microphone is off" : "Listening";
    case "thinking":
      return "Thinking about your answer";
    case "paused":
      return "Call paused";
    case "error":
      return "Something went wrong";
    default:
      return "";
  }
}
