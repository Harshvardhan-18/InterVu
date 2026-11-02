"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDictation,
  listVoices,
  onVoicesChanged,
  speakText,
  speechSupport,
  type Dictation,
  type SpeechHandle,
} from "@/lib/speech";
import {
  AUTO_PAUSE_AFTER_MS,
  DEFAULT_RATE,
  DEFAULT_SILENCE_MS,
  MAX_RESTARTS,
  NUDGE_AFTER_MS,
  NUDGE_TEXT,
  RESTART_WINDOW_MS,
  isRepeatCommand,
  joinTranscript,
  type AnswerOutcome,
  type CallPhase,
} from "@/lib/voice-call";

const STORAGE = {
  silence: "intervu_call_silence_ms",
  rate: "intervu_call_rate",
  voice: "intervu_call_voice",
} as const;

const FATAL_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow the microphone for this site in your browser, or switch to typing.",
  "service-not-allowed": "Your browser's speech service is not available. You can switch to typing.",
  "audio-capture": "No microphone was found. Connect one, or switch to typing.",
  network: "The browser's speech service could not be reached. Check your connection, or switch to typing.",
};

export type VoiceCallOptions = {
  /** Send the spoken answer; resolves with what to say next. */
  onAnswer: (text: string) => Promise<AnswerOutcome>;
  /** The interview is over and the closing line was spoken. */
  onComplete: () => void;
  /** The candidate leaves the call to type; `draft` is what they had said so far. */
  onSwitchToTyping: (draft: string) => void;
};

/**
 * Controller for a hands-free voice interview, like a phone call with the
 * interviewer:
 *
 *   speaking (interviewer reads the question)
 *     -> listening (your microphone is on; your words appear live)
 *     -> [you stop talking for `silenceMs`]
 *     -> thinking (the answer is sent)
 *     -> speaking (next question) ... -> closing line -> report
 *
 * The microphone is never open while the interviewer speaks (so it cannot
 * hear itself), speech recognition is restarted when the browser ends it, and
 * every browser failure degrades to "switch to typing" instead of breaking
 * the interview. All speech runs through the browser; InterVu receives text
 * only.
 */
export function useVoiceCall(options: VoiceCallOptions) {
  const [supported, setSupported] = useState({ speak: false, dictate: false });
  const [phase, setPhaseState] = useState<CallPhase>("idle");
  const [muted, setMutedState] = useState(false);
  const [interviewerText, setInterviewerText] = useState("");
  const [yourText, setYourText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [silenceArmedAt, setSilenceArmedAt] = useState<number | null>(null);
  const [silenceMs, setSilenceMsState] = useState<number>(DEFAULT_SILENCE_MS);
  const [rate, setRateState] = useState<number>(DEFAULT_RATE);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs mirror state so timers and speech callbacks always see current values.
  const phaseRef = useRef<CallPhase>("idle");
  const mutedRef = useRef(false);
  const silenceMsRef = useRef<number>(DEFAULT_SILENCE_MS);
  const rateRef = useRef<number>(DEFAULT_RATE);
  const voiceRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  const questionRef = useRef("");
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef("");
  const pendingRef = useRef(""); // an answer whose submission failed, kept for "try again"
  const dictationRef = useRef<Dictation | null>(null);
  const speechRef = useRef<SpeechHandle | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clockTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stoppingForSubmit = useRef(false);
  const submittingRef = useRef(false);
  const nudgedRef = useRef(false);
  const restartTimes = useRef<number[]>([]);
  const startedAt = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const setPhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // ── Environment: support, saved settings, installed voices ────────────────
  useEffect(() => {
    const detected = speechSupport();
    const storedSilence = Number(window.localStorage.getItem(STORAGE.silence));
    const storedRate = Number(window.localStorage.getItem(STORAGE.rate));
    const storedVoice = window.localStorage.getItem(STORAGE.voice);
    // Browser-only values; applied after mount so the server render and first client render match.
    queueMicrotask(() => {
      setSupported(detected);
      if (storedSilence >= 1000 && storedSilence <= 10_000) {
        silenceMsRef.current = storedSilence;
        setSilenceMsState(storedSilence);
      }
      if (storedRate >= 0.5 && storedRate <= 2) {
        rateRef.current = storedRate;
        setRateState(storedRate);
      }
      if (storedVoice) {
        voiceRef.current = storedVoice;
        setVoiceURIState(storedVoice);
      }
      setVoices(listVoices());
    });
    return onVoicesChanged(() => setVoices(listVoices()));
  }, []);

  // ── Timers ────────────────────────────────────────────────────────────────
  const clearListenTimers = useCallback(() => {
    clearTimeout(silenceTimer.current);
    clearTimeout(nudgeTimer.current);
    clearTimeout(pauseTimer.current);
    clearTimeout(flushTimer.current);
    clearTimeout(restartTimer.current);
    setSilenceArmedAt(null);
  }, []);

  const stopRecognition = useCallback((abort: boolean) => {
    const dictation = dictationRef.current;
    dictationRef.current = null;
    if (!dictation) return;
    try {
      if (abort) dictation.abort();
      else dictation.stop();
    } catch {
      // already stopped
    }
  }, []);

  const stopSpeech = useCallback(() => {
    speechRef.current?.cancel();
    speechRef.current = null;
  }, []);

  const fail = useCallback(
    (message: string) => {
      clearListenTimers();
      stopRecognition(true);
      stopSpeech();
      submittingRef.current = false;
      stoppingForSubmit.current = false;
      setError(message);
      setPhase("error");
    },
    [clearListenTimers, setPhase, stopRecognition, stopSpeech],
  );

  // ── Speaking ──────────────────────────────────────────────────────────────
  // Declared before use through refs so speak/beginListening can call each other.
  const beginListeningRef = useRef<() => void>(() => {});
  const startRecognitionRef = useRef<() => void>(() => {});

  const say = useCallback(
    (text: string, then: () => void) => {
      clearListenTimers();
      stopRecognition(true);
      stopSpeech();
      setInterviewerText(text);
      setPhase("speaking");
      let done = false;
      const proceed = () => {
        if (done) return;
        done = true;
        speechRef.current = null;
        if (phaseRef.current === "idle") return; // the call was ended meanwhile
        then();
      };
      speechRef.current = speakText(text, {
        rate: rateRef.current,
        voiceURI: voiceRef.current,
        onEnd: proceed,
        // A voice that cannot speak must not strand the call: show the text and carry on.
        onError: proceed,
      });
    },
    [clearListenTimers, setPhase, stopRecognition, stopSpeech],
  );

  // ── Submitting an answer ──────────────────────────────────────────────────
  const submit = useCallback(
    async (text: string) => {
      if (submittingRef.current) return;
      const answer = text.trim();
      if (!answer) {
        beginListeningRef.current();
        return;
      }
      submittingRef.current = true;
      stoppingForSubmit.current = false;
      clearListenTimers();
      stopRecognition(true);
      setPhase("thinking");
      pendingRef.current = answer;
      setYourText(answer);

      let outcome: AnswerOutcome;
      try {
        outcome = await optionsRef.current.onAnswer(answer);
      } catch {
        outcome = { kind: "error", message: "Your answer could not be sent." };
      }
      submittingRef.current = false;
      if (phaseRef.current === "idle") return; // hung up while waiting

      if (outcome.kind === "error") {
        setError(outcome.message);
        setPhase("error");
        return;
      }
      pendingRef.current = "";
      finalsRef.current = [];
      interimRef.current = "";
      setYourText("");
      if (outcome.kind === "complete") {
        clearInterval(clockTimer.current);
        say(outcome.text, () => {
          setPhase("idle");
          optionsRef.current.onComplete();
        });
        return;
      }
      questionRef.current = outcome.text;
      say(outcome.text, () => beginListeningRef.current());
    },
    [clearListenTimers, say, setPhase, stopRecognition],
  );

  const currentTranscript = useCallback(() => joinTranscript(finalsRef.current, interimRef.current), []);

  /** Stop recognition so it delivers its last words, then send the answer. */
  const finishUtterance = useCallback(() => {
    if (submittingRef.current || stoppingForSubmit.current) return;
    if (!currentTranscript()) return;
    clearTimeout(silenceTimer.current);
    setSilenceArmedAt(null);
    stoppingForSubmit.current = true;
    const dictation = dictationRef.current;
    if (!dictation) {
      void submit(currentTranscript());
      return;
    }
    try {
      dictation.stop();
    } catch {
      // fall through to the timer
    }
    // Recognition normally ends within a moment; do not wait forever for it.
    flushTimer.current = setTimeout(() => void submit(currentTranscript()), 900);
  }, [currentTranscript, submit]);

  const armSilence = useCallback(() => {
    clearTimeout(silenceTimer.current);
    setSilenceArmedAt(Date.now());
    silenceTimer.current = setTimeout(finishUtterance, silenceMsRef.current);
  }, [finishUtterance]);

  // ── Listening ─────────────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (mutedRef.current || dictationRef.current) return;
    const dictation = createDictation({
      onText: (finalText, interimText) => {
        if (phaseRef.current !== "listening" || submittingRef.current) return;
        if (finalText.trim()) finalsRef.current.push(finalText.trim());
        interimRef.current = interimText;
        const spoken = currentTranscript();

        // "Could you repeat that?" on its own is a request, not an answer.
        if (spoken && isRepeatCommand(spoken)) {
          finalsRef.current = [];
          interimRef.current = "";
          setYourText("");
          say(questionRef.current, () => beginListeningRef.current());
          return;
        }
        setYourText(spoken);
        if (spoken) {
          clearTimeout(nudgeTimer.current);
          clearTimeout(pauseTimer.current);
          if (!stoppingForSubmit.current) armSilence();
        }
      },
      onEnd: () => {
        dictationRef.current = null;
        if (phaseRef.current !== "listening") return;
        if (stoppingForSubmit.current) {
          clearTimeout(flushTimer.current);
          void submit(currentTranscript());
          return;
        }
        if (mutedRef.current) return;
        // The browser ends recognition on its own now and then: start it again.
        const now = Date.now();
        restartTimes.current = restartTimes.current.filter((t) => now - t < RESTART_WINDOW_MS);
        restartTimes.current.push(now);
        if (restartTimes.current.length > MAX_RESTARTS) {
          fail("Speech recognition keeps stopping. Switch to typing, or try again in a moment.");
          return;
        }
        restartTimer.current = setTimeout(() => {
          if (phaseRef.current === "listening" && !mutedRef.current) startRecognitionRef.current();
        }, 250);
      },
      onError: (reason) => {
        if (reason === "no-speech" || reason === "aborted") return; // ordinary; onEnd restarts
        const message = FATAL_ERRORS[reason];
        if (message) fail(message);
      },
    });
    if (!dictation) {
      fail("This browser cannot listen for speech. Switch to typing, or try Chrome or Edge.");
      return;
    }
    dictationRef.current = dictation;
    try {
      dictation.start();
    } catch {
      dictationRef.current = null;
    }
  }, [armSilence, currentTranscript, fail, say, submit]);

  /** Pause the call if nothing is said for `ms`, instead of sending silence. */
  const armAutoPause = useCallback(
    (ms: number) => {
      clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => {
        if (phaseRef.current !== "listening" || currentTranscript()) return;
        mutedRef.current = true;
        setMutedState(true);
        stopRecognition(true);
        setPhase("paused");
      }, ms);
    },
    [currentTranscript, setPhase, stopRecognition],
  );

  const beginListening = useCallback(() => {
    if (phaseRef.current === "idle") return;
    clearListenTimers();
    stopRecognition(true);
    stoppingForSubmit.current = false;
    finalsRef.current = [];
    interimRef.current = "";
    setYourText("");
    setError(null);
    setPhase("listening");
    if (!mutedRef.current) startRecognition();

    // Gentle encouragement once if nothing is said, then pause instead of sending silence.
    if (!nudgedRef.current) {
      nudgeTimer.current = setTimeout(() => {
        if (phaseRef.current !== "listening" || currentTranscript() || mutedRef.current) return;
        nudgedRef.current = true;
        say(NUDGE_TEXT, () => {
          // Resume listening; speaking cleared the timers, so re-arm the auto-pause for the time left.
          setPhase("listening");
          startRecognition();
          armAutoPause(AUTO_PAUSE_AFTER_MS - NUDGE_AFTER_MS);
        });
      }, NUDGE_AFTER_MS);
    }
    armAutoPause(AUTO_PAUSE_AFTER_MS);
  }, [armAutoPause, clearListenTimers, currentTranscript, say, setPhase, startRecognition, stopRecognition]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
    startRecognitionRef.current = startRecognition;
  }, [beginListening, startRecognition]);

  // ── Controls ──────────────────────────────────────────────────────────────
  /** Open the call screen; the call itself starts when the user presses "Start call". */
  const openReady = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setError(null);
    setPhase("ready");
  }, [setPhase]);

  /** Start the call, speaking `question` first. Must be triggered by a user gesture. */
  const start = useCallback(
    (question: string) => {
      const support = speechSupport();
      if (!support.speak || !support.dictate) {
        setError("Voice calls need speech recognition and speech output. Chrome or Edge on desktop work best.");
        setPhase("error");
        return;
      }
      questionRef.current = question;
      mutedRef.current = false;
      setMutedState(false);
      nudgedRef.current = false;
      restartTimes.current = [];
      pendingRef.current = "";
      submittingRef.current = false;
      startedAt.current = Date.now();
      setElapsed(0);
      clearInterval(clockTimer.current);
      clockTimer.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
      setError(null);
      say(question, () => beginListeningRef.current());
    },
    [say, setPhase],
  );

  const end = useCallback(() => {
    clearListenTimers();
    clearInterval(clockTimer.current);
    stopRecognition(true);
    stopSpeech();
    submittingRef.current = false;
    stoppingForSubmit.current = false;
    finalsRef.current = [];
    interimRef.current = "";
    mutedRef.current = false;
    setMutedState(false);
    setYourText("");
    setError(null);
    setPhase("idle");
  }, [clearListenTimers, setPhase, stopRecognition, stopSpeech]);

  const switchToTyping = useCallback(() => {
    const draft = pendingRef.current || currentTranscript();
    end();
    optionsRef.current.onSwitchToTyping(draft);
  }, [currentTranscript, end]);

  const toggleMute = useCallback(() => {
    if (phaseRef.current !== "listening" && phaseRef.current !== "paused") return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMutedState(next);
    if (next) {
      clearTimeout(silenceTimer.current);
      clearTimeout(nudgeTimer.current);
      clearTimeout(pauseTimer.current);
      setSilenceArmedAt(null);
      stopRecognition(true);
    } else {
      setPhase("listening");
      startRecognition();
      if (currentTranscript()) armSilence();
      armAutoPause(AUTO_PAUSE_AFTER_MS);
    }
  }, [armAutoPause, armSilence, currentTranscript, setPhase, startRecognition, stopRecognition]);

  /** Interrupt the interviewer and answer now. */
  const skipToListening = useCallback(() => {
    if (phaseRef.current !== "speaking") return;
    stopSpeech();
    beginListening();
  }, [beginListening, stopSpeech]);

  const repeatQuestion = useCallback(() => {
    if (!questionRef.current || phaseRef.current === "thinking" || phaseRef.current === "idle") return;
    say(questionRef.current, () => beginListeningRef.current());
  }, [say]);

  /** Send what has been said so far without waiting for the pause. */
  const sendNow = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    finishUtterance();
  }, [finishUtterance]);

  /** After an error: send the same answer again. */
  const retry = useCallback(() => {
    const answer = pendingRef.current;
    setError(null);
    if (answer) void submit(answer);
    else beginListening();
  }, [beginListening, submit]);

  const setSilenceMs = useCallback((value: number) => {
    silenceMsRef.current = value;
    setSilenceMsState(value);
    window.localStorage.setItem(STORAGE.silence, String(value));
  }, []);
  const setRate = useCallback((value: number) => {
    rateRef.current = value;
    setRateState(value);
    window.localStorage.setItem(STORAGE.rate, String(value));
  }, []);
  const setVoiceURI = useCallback((value: string | null) => {
    voiceRef.current = value;
    setVoiceURIState(value);
    if (value) window.localStorage.setItem(STORAGE.voice, value);
    else window.localStorage.removeItem(STORAGE.voice);
  }, []);

  // Hang up when leaving the page.
  useEffect(() => {
    return () => {
      clearTimeout(silenceTimer.current);
      clearTimeout(nudgeTimer.current);
      clearTimeout(pauseTimer.current);
      clearTimeout(flushTimer.current);
      clearTimeout(restartTimer.current);
      clearInterval(clockTimer.current);
      dictationRef.current?.abort();
      speechRef.current?.cancel();
    };
  }, []);

  return useMemo(
    () => ({
      supported: supported.speak && supported.dictate,
      phase,
      active: phase !== "idle",
      muted,
      interviewerText,
      yourText,
      error,
      elapsed,
      silenceArmedAt,
      silenceMs,
      rate,
      voiceURI,
      voices,
      openReady,
      start,
      end,
      switchToTyping,
      toggleMute,
      skipToListening,
      repeatQuestion,
      sendNow,
      retry,
      setSilenceMs,
      setRate,
      setVoiceURI,
    }),
    [
      supported, phase, muted, interviewerText, yourText, error, elapsed, silenceArmedAt, silenceMs, rate, voiceURI,
      voices, openReady, start, end, switchToTyping, toggleMute, skipToListening, repeatQuestion, sendNow, retry,
      setSilenceMs, setRate, setVoiceURI,
    ],
  );
}

export type VoiceCall = ReturnType<typeof useVoiceCall>;
