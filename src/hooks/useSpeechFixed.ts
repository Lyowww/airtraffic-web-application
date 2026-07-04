"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dedupeSpeechTranscript } from "@/lib/chat-utils";

export type SpeechError =
  | "not-supported"
  | "mic-denied"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "aborted"
  | "unknown";

export interface UseSpeechFixedOptions {
  lang?: string;
  voiceRate?: number;
  voicePitch?: number;
  /** When true, automatically finishes listening after silence once speech was detected */
  autoFinishOnSilence?: boolean;
  /** Milliseconds of silence before auto-finish (default 2500) */
  silenceThresholdMs?: number;
}

export interface SpeakOptions {
  onEnd?: () => void;
  onError?: (error: SpeechError) => void;
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ?? null;
}

function mapRecognitionError(error: string): SpeechError {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "mic-denied";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "audio-capture":
      return "audio-capture";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export function useSpeechFixed(options: UseSpeechFixedOptions = {}) {
  const {
    lang = "en-US",
    voiceRate = 0.95,
    voicePitch = 1,
    autoFinishOnSilence = false,
    silenceThresholdMs = 2500,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAwaitingDone, setIsAwaitingDone] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const speakEndCallbackRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef<((text: string) => void) | null>(null);
  const onErrorRef = useRef<((error: SpeechError) => void) | null>(null);
  const lastSpeechActivityRef = useRef(0);
  const hasDetectedSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishRef = useRef(autoFinishOnSilence);
  const silenceThresholdRef = useRef(silenceThresholdMs);
  /** Tracks the highest result index processed in the current recognition session */
  const lastProcessedIndexRef = useRef(-1);
  const restartCountRef = useRef(0);
  const MAX_RESTARTS = 8;

  autoFinishRef.current = autoFinishOnSilence;
  silenceThresholdRef.current = silenceThresholdMs;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const appendFinalSegment = useCallback((text: string) => {
    const segment = text.trim();
    if (!segment) return;

    const combined = `${finalTranscriptRef.current} ${segment}`.trim();
    finalTranscriptRef.current = dedupeSpeechTranscript(combined);
    setTranscript(finalTranscriptRef.current);
  }, []);

  const scheduleAutoFinish = useCallback(() => {
    if (!autoFinishRef.current || !keepListeningRef.current) return;
    if (!hasDetectedSpeechRef.current) return;

    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!keepListeningRef.current) return;

      const elapsed = Date.now() - lastSpeechActivityRef.current;
      if (elapsed < silenceThresholdRef.current - 100) return;

      keepListeningRef.current = false;

      const fullText = dedupeSpeechTranscript(
        `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim(),
      );

      recognitionRef.current?.stop();

      setIsListening(false);
      setIsAwaitingDone(false);
      setInterimTranscript("");
      setTranscript(fullText);
      finalTranscriptRef.current = fullText;

      const cb = onCompleteRef.current;
      onCompleteRef.current = null;
      onErrorRef.current = null;

      if (fullText) {
        cb?.(fullText);
      }
    }, silenceThresholdRef.current);
  }, [clearSilenceTimer]);

  const markSpeechActivity = useCallback(() => {
    lastSpeechActivityRef.current = Date.now();
    hasDetectedSpeechRef.current = true;
    if (autoFinishRef.current) {
      scheduleAutoFinish();
    }
  }, [scheduleAutoFinish]);

  useEffect(() => {
    const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;
    const hasSTT = getSpeechRecognition() !== null;
    setIsSupported(hasTTS && hasSTT);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    speakEndCallbackRef.current = null;
  }, []);

  const abortListening = useCallback(() => {
    keepListeningRef.current = false;
    clearSilenceTimer();
    hasDetectedSpeechRef.current = false;
    restartCountRef.current = 0;
    lastProcessedIndexRef.current = -1;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    setIsAwaitingDone(false);
    onCompleteRef.current = null;
    onErrorRef.current = null;
  }, [clearSilenceTimer]);

  const speak = useCallback(
    (text: string, speakOptions?: SpeakOptions) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        speakOptions?.onError?.("not-supported");
        return;
      }

      abortListening();
      stopSpeaking();
      setError(null);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find((v) => v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;

      speakEndCallbackRef.current = speakOptions?.onEnd ?? null;

      utterance.onstart = () => setIsSpeaking(true);

      utterance.onend = () => {
        setIsSpeaking(false);
        const cb = speakEndCallbackRef.current;
        speakEndCallbackRef.current = null;
        cb?.();
      };

      utterance.onerror = (event) => {
        if (event.error === "interrupted" || event.error === "canceled") return;
        setIsSpeaking(false);
        setError("unknown");
        speakOptions?.onError?.("unknown");
      };

      window.speechSynthesis.speak(utterance);
    },
    [lang, voicePitch, voiceRate, abortListening, stopSpeaking],
  );

  const handleRecognitionResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          if (i > lastProcessedIndexRef.current) {
            lastProcessedIndexRef.current = i;
            appendFinalSegment(text);
            if (text.trim()) markSpeechActivity();
          }
        } else {
          interim += text;
          if (text.trim()) markSpeechActivity();
        }
      }

      const trimmed = interim.trim();
      interimTranscriptRef.current = trimmed;
      setInterimTranscript(trimmed);
    },
    [appendFinalSegment, markSpeechActivity],
  );

  const startRecognition = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("not-supported");
      onErrorRef.current?.("not-supported");
      return;
    }

    lastProcessedIndexRef.current = -1;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setIsAwaitingDone(true);
    };

    recognition.onresult = handleRecognitionResult;

    recognition.onspeechend = () => {
      if (autoFinishRef.current && hasDetectedSpeechRef.current) {
        scheduleAutoFinish();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const mapped = mapRecognitionError(event.error);

      if (mapped === "no-speech" && keepListeningRef.current) {
        return;
      }

      if (mapped !== "aborted") {
        setError(mapped);
        onErrorRef.current?.(mapped);
      }
    };

    recognition.onend = () => {
      if (!keepListeningRef.current) {
        setIsListening(false);
        setIsAwaitingDone(false);
        recognitionRef.current = null;
        return;
      }

      if (restartCountRef.current >= MAX_RESTARTS) {
        keepListeningRef.current = false;
        setIsListening(false);
        setIsAwaitingDone(false);
        recognitionRef.current = null;
        return;
      }

      restartCountRef.current += 1;
      lastProcessedIndexRef.current = -1;

      const SR = getSpeechRecognition();
      if (!SR) return;

      const next = new SR();
      next.lang = lang;
      next.continuous = true;
      next.interimResults = true;
      next.maxAlternatives = 1;
      next.onstart = recognition.onstart;
      next.onresult = handleRecognitionResult;
      next.onerror = recognition.onerror;
      next.onend = recognition.onend;
      next.onspeechend = recognition.onspeechend;

      recognitionRef.current = next;

      try {
        next.start();
      } catch {
        keepListeningRef.current = false;
        setIsListening(false);
        setIsAwaitingDone(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("unknown");
      onErrorRef.current?.("unknown");
    }
  }, [handleRecognitionResult, lang, scheduleAutoFinish]);

  const startListening = useCallback(
    (callbacks?: {
      onComplete?: (transcript: string) => void;
      onError?: (error: SpeechError) => void;
    }) => {
      const SR = getSpeechRecognition();
      if (!SR) {
        setError("not-supported");
        callbacks?.onError?.("not-supported");
        return;
      }

      stopSpeaking();
      abortListening();
      setError(null);
      setTranscript("");
      setInterimTranscript("");
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";

      onCompleteRef.current = callbacks?.onComplete ?? null;
      onErrorRef.current = callbacks?.onError ?? null;
      keepListeningRef.current = true;
      hasDetectedSpeechRef.current = false;
      restartCountRef.current = 0;
      lastSpeechActivityRef.current = Date.now();

      startRecognition();
    },
    [abortListening, startRecognition, stopSpeaking],
  );

  const finishListening = useCallback(() => {
    if (!keepListeningRef.current && !isListening) return "";

    keepListeningRef.current = false;
    clearSilenceTimer();

    const fullText = dedupeSpeechTranscript(
      `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim(),
    );

    recognitionRef.current?.stop();

    setIsListening(false);
    setIsAwaitingDone(false);
    setInterimTranscript("");
    setTranscript(fullText);
    finalTranscriptRef.current = fullText;

    const cb = onCompleteRef.current;
    onCompleteRef.current = null;
    onErrorRef.current = null;

    if (fullText) {
      cb?.(fullText);
    }

    return fullText;
  }, [clearSilenceTimer, isListening]);

  const liveTranscript = useMemo(() => {
    return dedupeSpeechTranscript(
      `${transcript} ${interimTranscript}`.trim(),
    );
  }, [transcript, interimTranscript]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      abortListening();
      stopSpeaking();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [abortListening, stopSpeaking]);

  return {
    isSpeaking,
    isListening,
    isAwaitingDone,
    isSupported,
    transcript,
    interimTranscript,
    liveTranscript,
    error,
    speak,
    startListening,
    finishListening,
    stopSpeaking,
    abortListening,
    clearError: () => setError(null),
  };
}
