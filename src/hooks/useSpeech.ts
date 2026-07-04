"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechError =
  | "not-supported"
  | "mic-denied"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "aborted"
  | "unknown";

export interface UseSpeechOptions {
  lang?: string;
  voiceRate?: number;
  voicePitch?: number;
}

export interface SpeakOptions {
  onEnd?: () => void;
  onError?: (error: SpeechError) => void;
}

export interface ListenOptions {
  onResult?: (transcript: string) => void;
  onEnd?: () => void;
  onError?: (error: SpeechError) => void;
  continuous?: boolean;
  interimResults?: boolean;
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

export function useSpeech(options: UseSpeechOptions = {}) {
  const { lang = "en-US", voiceRate = 0.95, voicePitch = 1 } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speakEndCallbackRef = useRef<(() => void) | null>(null);
  const listenEndCallbackRef = useRef<(() => void) | null>(null);
  const listenResultCallbackRef = useRef<((transcript: string) => void) | null>(null);
  const listenErrorCallbackRef = useRef<((error: SpeechError) => void) | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const accumulatedTranscriptRef = useRef("");

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
    utteranceRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    listenEndCallbackRef.current = null;
    listenResultCallbackRef.current = null;
    listenErrorCallbackRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string, speakOptions?: SpeakOptions) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        speakOptions?.onError?.("not-supported");
        return;
      }

      stopListening();
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
        utteranceRef.current = null;
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

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [lang, voicePitch, voiceRate, stopListening, stopSpeaking],
  );

  const listen = useCallback(
    (listenOptions?: ListenOptions) => {
      const SR = getSpeechRecognition();
      if (!SR) {
        setError("not-supported");
        listenOptions?.onError?.("not-supported");
        return;
      }

      stopSpeaking();
      stopListening();
      setError(null);
      setLastTranscript("");
      accumulatedTranscriptRef.current = "";

      const recognition = new SR();
      recognition.lang = lang;
      recognition.continuous = listenOptions?.continuous ?? false;
      recognition.interimResults = listenOptions?.interimResults ?? false;
      recognition.maxAlternatives = 1;

      listenResultCallbackRef.current = listenOptions?.onResult ?? null;
      listenEndCallbackRef.current = listenOptions?.onEnd ?? null;
      listenErrorCallbackRef.current = listenOptions?.onError ?? null;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";

          if (result.isFinal) {
            accumulatedTranscriptRef.current = `${accumulatedTranscriptRef.current} ${text}`.trim();
          } else {
            interim += text;
          }
        }

        const combined = `${accumulatedTranscriptRef.current} ${interim}`.trim();
        if (combined) {
          setLastTranscript(combined);
          listenResultCallbackRef.current?.(combined);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const mapped = mapRecognitionError(event.error);
        if (mapped !== "aborted") {
          setError(mapped);
          listenErrorCallbackRef.current?.(mapped);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        const cb = listenEndCallbackRef.current;
        listenEndCallbackRef.current = null;
        cb?.();
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch {
        setError("unknown");
        listenOptions?.onError?.("unknown");
      }
    },
    [lang, stopListening, stopSpeaking],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      stopSpeaking();
      stopListening();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [stopListening, stopSpeaking]);

  return {
    isSpeaking,
    isListening,
    isSupported,
    lastTranscript,
    error,
    speak,
    listen,
    stopSpeaking,
    stopListening,
    clearError: () => setError(null),
  };
}
