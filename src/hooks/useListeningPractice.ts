"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechFixed, type SpeechError } from "@/hooks/useSpeechFixed";
import { buildSpokenFeedback } from "@/lib/chat-utils";
import type {
  ChatResponseBody,
  ConversationMessage,
  LessonListening,
} from "@/types/lesson";

export type PracticeStatus =
  | "idle"
  | "speaking"
  | "listening"
  | "processing"
  | "error";

function createMessage(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

export function useListeningPractice(listening: LessonListening | null) {
  const [practiceActive, setPracticeActive] = useState(false);
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  const practiceActiveRef = useRef(false);
  const currentQuestionRef = useRef("");
  const processingRef = useRef(false);

  const {
    speak,
    startListening,
    finishListening,
    stopSpeaking,
    abortListening,
    isSupported,
    liveTranscript,
    isAwaitingDone,
  } = useSpeechFixed({ autoFinishOnSilence: true, silenceThresholdMs: 2200 });

  practiceActiveRef.current = practiceActive;
  currentQuestionRef.current = currentQuestion;

  const handleListenError = useCallback((err: SpeechError) => {
    if (err === "mic-denied") {
      setError("Microphone access denied. Please allow microphone access.");
      setPracticeActive(false);
      practiceActiveRef.current = false;
      setStatus("error");
    } else if (err !== "aborted" && err !== "no-speech") {
      setStatus("error");
    }
  }, []);

  const processAnswer = useCallback(
    async (userAnswer: string) => {
      if (!userAnswer.trim() || processingRef.current || !listening) return;

      processingRef.current = true;
      setStatus("processing");
      setError(null);
      setLastAnswer(userAnswer);
      setHistory((prev) => [...prev, createMessage("user", userAnswer)]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "listening-comprehension",
            userAnswer,
            conversationHistory: history,
            lessonTitle: listening.title,
            sourceText: listening.transcript,
            currentQuestion: currentQuestionRef.current,
            contextHint: "Answer based on the listening content.",
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to evaluate answer");
        }

        const result = (await response.json()) as ChatResponseBody;
        const spoken = buildSpokenFeedback(result);

        setLastFeedback(result.feedback);
        setCurrentQuestion(result.nextQuestion);
        currentQuestionRef.current = result.nextQuestion;
        setHistory((prev) => [...prev, createMessage("assistant", spoken)]);

        processingRef.current = false;

        if (practiceActiveRef.current) {
          setStatus("speaking");
          speak(spoken, {
            onEnd: () => {
              if (!practiceActiveRef.current) {
                setStatus("idle");
                return;
              }
              setStatus("listening");
              startListening({
                onComplete: (answer) => {
                  if (answer.trim()) void processAnswer(answer);
                },
                onError: handleListenError,
              });
            },
          });
        } else {
          setStatus("idle");
        }
      } catch (err) {
        processingRef.current = false;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      }
    },
    [handleListenError, history, listening, speak, startListening],
  );

  const beginListening = useCallback(() => {
    if (!practiceActiveRef.current) return;
    setStatus("listening");
    startListening({
      onComplete: (answer) => {
        if (answer.trim()) void processAnswer(answer);
      },
      onError: handleListenError,
    });
  }, [handleListenError, processAnswer, startListening]);

  const startPractice = useCallback(() => {
    if (!listening || !isSupported) {
      setError(
        isSupported
          ? "Select or import a listening first."
          : "Speech is not supported in this browser.",
      );
      return;
    }

    setError(null);
    setHistory([]);
    setLastAnswer("");
    setLastFeedback("");
    practiceActiveRef.current = true;
    setPracticeActive(true);

    const intro = `Aghas jan, welcome. I will ask you questions about your listening titled ${listening.title}. What is the main idea of this listening?`;
    const firstQuestion = "What is the main idea of this listening?";

    setCurrentQuestion(firstQuestion);
    currentQuestionRef.current = firstQuestion;
    setHistory([createMessage("assistant", intro)]);
    setStatus("speaking");

    speak(intro, {
      onEnd: () => beginListening(),
    });
  }, [beginListening, isSupported, listening, speak]);

  const stopPractice = useCallback(() => {
    practiceActiveRef.current = false;
    setPracticeActive(false);
    stopSpeaking();
    abortListening();
    processingRef.current = false;
    setStatus("idle");
  }, [abortListening, stopSpeaking]);

  const finishResponding = useCallback(() => {
    const answer = finishListening();
    if (answer.trim()) {
      void processAnswer(answer);
    }
  }, [finishListening, processAnswer]);

  const resetPractice = useCallback(() => {
    stopPractice();
    setHistory([]);
    setLastAnswer("");
    setLastFeedback("");
    setCurrentQuestion("");
    setError(null);
  }, [stopPractice]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      abortListening();
    };
  }, [abortListening, stopSpeaking]);

  return {
    practiceActive,
    status,
    history,
    currentQuestion,
    lastAnswer,
    lastFeedback,
    error,
    liveTranscript,
    isAwaitingDone,
    isSupported,
    startPractice,
    stopPractice,
    finishResponding,
    resetPractice,
  };
}
