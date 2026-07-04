"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLesson } from "@/context/LessonContext";
import { useSpeechFixed, type SpeechError } from "@/hooks/useSpeechFixed";
import { buildSpokenFeedback } from "@/lib/chat-utils";
import type { ChatMode, ChatResponseBody } from "@/types/lesson";

export function useDriveMode() {
  const {
    lesson,
    currentItem,
    conversationHistory,
    driveMode,
    useCustomText,
    selectedCustomText,
    setDriveMode,
    setStatus,
    setLastUserAnswer,
    setLastAiFeedback,
    setApiError,
    addMessage,
    advanceToNextItem,
  } = useLesson();

  const {
    speak,
    startListening,
    finishListening,
    stopSpeaking,
    abortListening,
    isSupported,
    isAwaitingDone,
    liveTranscript,
    error: speechError,
    clearError,
  } = useSpeechFixed({ autoFinishOnSilence: true, silenceThresholdMs: 2200 });

  const processingRef = useRef(false);
  const driveModeRef = useRef(driveMode);
  const currentQuestionRef = useRef(currentItem.question);

  driveModeRef.current = driveMode;
  currentQuestionRef.current = useCustomText
    ? "What is the main topic of this reading?"
    : currentItem.question;

  const getChatMode = useCallback((): ChatMode => {
    return useCustomText ? "custom-text" : "drive-lesson";
  }, [useCustomText]);

  const buildChatPayload = useCallback(
    (userAnswer: string) => {
      const mode = getChatMode();

      if (mode === "custom-text" && selectedCustomText) {
        return {
          mode,
          userAnswer,
          conversationHistory,
          lessonTitle: selectedCustomText.title,
          sourceText: selectedCustomText.content,
          currentQuestion: currentQuestionRef.current,
          contextHint: "Answer based on the imported reading text.",
        };
      }

      return {
        mode,
        userAnswer,
        conversationHistory,
        lessonTitle: lesson.title,
        currentQuestion: currentItem.question,
        contextHint: currentItem.contextHint,
        expectedKeywords: currentItem.expectedKeywords,
      };
    },
    [
      conversationHistory,
      currentItem,
      getChatMode,
      lesson.title,
      selectedCustomText,
    ],
  );

  const handleListenError = useCallback(
    (err: SpeechError) => {
      if (err === "mic-denied") {
        setStatus("mic-denied");
        setDriveMode(false);
        driveModeRef.current = false;
      } else if (err !== "aborted" && err !== "no-speech") {
        setStatus("error");
      }
    },
    [setDriveMode, setStatus],
  );

  const processAnswer = useCallback(
    async (userAnswer: string) => {
      if (!userAnswer.trim() || processingRef.current) return;
      processingRef.current = true;
      setStatus("processing");
      setApiError(null);
      setLastUserAnswer(userAnswer);
      addMessage("user", userAnswer);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildChatPayload(userAnswer)),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to evaluate answer");
        }

        const result = (await response.json()) as ChatResponseBody;
        const spoken = buildSpokenFeedback(result);

        setLastAiFeedback(result.feedback);
        addMessage("assistant", spoken);
        currentQuestionRef.current = result.nextQuestion;

        if (result.shouldAdvance && !useCustomText) {
          advanceToNextItem();
        }

        processingRef.current = false;

        if (driveModeRef.current) {
          speakThenListenRef.current(spoken);
        } else {
          setStatus("idle");
        }
      } catch (err) {
        processingRef.current = false;
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setApiError(message);
        setStatus("error");

        if (driveModeRef.current) {
          speak(
            "Aghas jan, sorry, I had trouble connecting. Let's try that question again.",
            {
              onEnd: () =>
                speakThenListenRef.current(currentQuestionRef.current),
            },
          );
        }
      }
    },
    [
      addMessage,
      advanceToNextItem,
      buildChatPayload,
      setApiError,
      setLastAiFeedback,
      setLastUserAnswer,
      setStatus,
      speak,
      useCustomText,
    ],
  );

  const beginListening = useCallback(() => {
    if (!driveModeRef.current) return;
    setStatus("awaiting-done");
    startListening({
      onComplete: (answer) => {
        if (answer.trim()) {
          void processAnswer(answer);
        }
      },
      onError: handleListenError,
    });
  }, [handleListenError, processAnswer, setStatus, startListening]);

  const speakThenListenRef = useRef<(text: string) => void>(() => {});

  const speakThenListen = useCallback(
    (text: string) => {
      if (!driveModeRef.current) return;

      setStatus("speaking");
      speak(text, {
        onEnd: () => beginListening(),
        onError: () => setStatus("error"),
      });
    },
    [beginListening, setStatus, speak],
  );

  useEffect(() => {
    speakThenListenRef.current = speakThenListen;
  }, [speakThenListen]);

  const finishResponding = useCallback(() => {
    const answer = finishListening();
    if (!answer.trim()) {
      setApiError("No speech was detected. Please try speaking again.");
      if (driveModeRef.current) {
        beginListening();
      }
      return;
    }
    void processAnswer(answer);
  }, [beginListening, finishListening, processAnswer, setApiError]);

  const startDriveMode = useCallback(() => {
    if (!isSupported) {
      setStatus("error");
      setApiError("Speech recognition is not supported in this browser.");
      return;
    }

    if (useCustomText && !selectedCustomText) {
      setApiError("Please import and select a reading text first.");
      return;
    }

    clearError();
    setApiError(null);
    driveModeRef.current = true;
    setDriveMode(true);
    setStatus("speaking");

    const intro = useCustomText
      ? `Aghas jan, welcome. I will ask you questions about your reading text titled ${selectedCustomText?.title}. What is the main topic of this reading?`
      : `Aghas jan, welcome to ${lesson.title}. ${currentItem.question}`;

    currentQuestionRef.current = useCustomText
      ? "What is the main topic of this reading?"
      : currentItem.question;

    addMessage("assistant", intro);

    speak(intro, {
      onEnd: () => beginListening(),
    });
  }, [
    isSupported,
    useCustomText,
    selectedCustomText,
    clearError,
    setApiError,
    setDriveMode,
    setStatus,
    lesson.title,
    currentItem.question,
    addMessage,
    speak,
    beginListening,
  ]);

  const stopDriveMode = useCallback(() => {
    driveModeRef.current = false;
    setDriveMode(false);
    stopSpeaking();
    abortListening();
    processingRef.current = false;
    setStatus("idle");
  }, [abortListening, setDriveMode, setStatus, stopSpeaking]);

  const toggleDriveMode = useCallback(() => {
    if (driveMode) {
      stopDriveMode();
    } else {
      startDriveMode();
    }
  }, [driveMode, stopDriveMode, startDriveMode]);

  return {
    driveMode,
    toggleDriveMode,
    stopDriveMode,
    finishResponding,
    isAwaitingDone,
    liveTranscript,
    isSupported,
    speechError,
  };
}
