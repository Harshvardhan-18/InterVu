/**
 * Browser speech helpers (Web Speech API). Everything is opt-in and runs
 * through the browser:
 *  - Text-to-speech (`speechSynthesis`) stays on the device.
 *  - Dictation (`SpeechRecognition`) is performed by the browser's speech
 *    service. In Chrome that means the audio is sent to Google; InterVu never
 *    receives or stores any audio, only the text you choose to submit.
 */

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

export type Dictation = { start: () => void; stop: () => void };

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
  return { start: () => recognition.start(), stop: () => recognition.stop() };
}
