"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDictation, speak, speechSupport, stopSpeaking, type Dictation } from "@/lib/speech";

const STORAGE_KEY = "intervu_voice_read_aloud";

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser to dictate.",
  "service-not-allowed": "Your browser's speech service is not available.",
  "no-speech": "No speech was heard. Try again.",
  "audio-capture": "No microphone was found.",
  network: "The browser's speech service could not be reached.",
};

/**
 * Optional voice for the interview: read questions aloud and dictate answers.
 * Both are off until the user turns them on. Support is detected after mount
 * so the server render and the first client render match.
 */
export function useVoice(onFinalText: (text: string) => void) {
  const [support, setSupport] = useState({ speak: false, dictate: false });
  const [readAloud, setReadAloudState] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dictationRef = useRef<Dictation | null>(null);
  const onFinalRef = useRef(onFinalText);

  useEffect(() => {
    onFinalRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    // Feature detection and the saved preference are only knowable in the browser.
    const detected = speechSupport();
    const saved = window.localStorage.getItem(STORAGE_KEY) === "1";
    queueMicrotask(() => {
      setSupport(detected);
      setReadAloudState(saved && detected.speak);
    });
    return () => {
      dictationRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const setReadAloud = useCallback((on: boolean) => {
    setReadAloudState(on);
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    if (!on) stopSpeaking();
  }, []);

  const say = useCallback(
    (text: string) => {
      if (readAloud) speak(text);
    },
    [readAloud],
  );

  const stopListening = useCallback(() => {
    dictationRef.current?.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      dictationRef.current?.stop();
      return;
    }
    setError(null);
    stopSpeaking(); // do not transcribe the interviewer's own voice
    const dictation = createDictation({
      onText: (finalText, interimText) => {
        if (finalText.trim()) onFinalRef.current(finalText.trim());
        setInterim(interimText);
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
      onError: (reason) => setError(ERROR_TEXT[reason] ?? `Dictation stopped (${reason}).`),
    });
    if (!dictation) {
      setError("Dictation is not supported in this browser.");
      return;
    }
    dictationRef.current = dictation;
    try {
      dictation.start();
      setListening(true);
    } catch {
      setError("Could not start dictation.");
    }
  }, [listening]);

  return { support, readAloud, setReadAloud, say, listening, interim, error, toggleListening, stopListening };
}
