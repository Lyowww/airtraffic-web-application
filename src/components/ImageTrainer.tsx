"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  Mic,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { useLesson } from "@/context/LessonContext";
import { useSpeechFixed } from "@/hooks/useSpeechFixed";
import type { ChatResponseBody, LessonImage } from "@/types/lesson";

function pickRandomImage(images: LessonImage[]): LessonImage | null {
  if (images.length === 0) return null;
  const index = Math.floor(Math.random() * images.length);
  return images[index] ?? null;
}

export function ImageTrainer() {
  const { customImages } = useLesson();
  const [currentImage, setCurrentImage] = useState<LessonImage | null>(null);
  const [feedback, setFeedback] = useState<ChatResponseBody | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    speak,
    startListening,
    finishListening,
    abortListening,
    isSupported,
    isAwaitingDone,
    liveTranscript,
    isSpeaking,
    error: speechError,
    clearError,
  } = useSpeechFixed();

  const hasImages = customImages.length > 0;

  const displayTranscript = useMemo(() => {
    return liveTranscript || "Tap the microphone and describe what you see…";
  }, [liveTranscript]);

  const loadRandomCard = useCallback(() => {
    abortListening();
    setFeedback(null);
    setError(null);
    setCurrentImage(pickRandomImage(customImages));
  }, [abortListening, customImages]);

  const startCard = useCallback(() => {
    const image = pickRandomImage(customImages);
    setCurrentImage(image);
    setFeedback(null);
    setError(null);

    if (!image) return;

    const prompt =
      "Aghas jan, look at this image and tell me what you see. Take your time.";
    speak(prompt);
  }, [customImages, speak]);

  const startMic = useCallback(() => {
    if (!currentImage) return;
    clearError();
    setError(null);
    setFeedback(null);
    startListening();
  }, [clearError, currentImage, startListening]);

  const submitDescription = useCallback(async () => {
    if (!currentImage) return;

    const answer = finishListening();
    if (!answer.trim()) {
      setError("No speech detected. Please describe the image and try again.");
      return;
    }

    setIsGrading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image-flashcard",
          userAnswer: answer,
          conversationHistory: [],
          imageBase64: currentImage.imageSrc,
          standardExplanation: currentImage.standardExplanation,
          lessonTitle: currentImage.title,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to grade your answer");
      }

      const result = (await response.json()) as ChatResponseBody;
      setFeedback(result);

      const spoken = [
        result.validation,
        result.corrections,
        result.tips,
        result.encouragement,
      ]
        .filter(Boolean)
        .join(" ");

      speak(spoken);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setIsGrading(false);
    }
  }, [currentImage, finishListening, speak]);

  if (!hasImages) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <ImageIcon className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]" />
        <h2 className="text-xl font-semibold">No flashcard images yet</h2>
        <p className="mt-2 text-[var(--muted)]">
          Import images with their correct explanations in the Image Import
          section, then come back here for random flashcard practice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startCard}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          <Shuffle className="h-5 w-5" aria-hidden />
          Random Image
        </button>
        {currentImage && (
          <button
            type="button"
            onClick={loadRandomCard}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-5 w-5" aria-hidden />
            Next Image
          </button>
        )}
      </div>

      {currentImage && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{currentImage.title}</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-zinc-100 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.imageSrc}
              alt={currentImage.title}
              className="mx-auto max-h-80 w-full object-contain"
            />
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Aghas jan, describe what you see. Tap the mic, speak at your own
            pace, then tap Done Responding when finished.
          </p>
        </section>
      )}

      {currentImage && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {!isAwaitingDone ? (
              <button
                type="button"
                onClick={startMic}
                disabled={!isSupported || isGrading || isSpeaking}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Mic className="h-5 w-5" aria-hidden />
                Start Speaking
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submitDescription()}
                disabled={isGrading}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {isGrading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                )}
                Done Responding
              </button>
            )}
          </div>

          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-base leading-relaxed text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {displayTranscript}
          </p>
        </section>
      )}

      {feedback && (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200">
            Teacher feedback
          </h3>
          <div className="space-y-2 text-sm leading-relaxed sm:text-base">
            <p>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                What you did right:{" "}
              </span>
              {feedback.validation}
            </p>
            <p>
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Corrections:{" "}
              </span>
              {feedback.corrections}
            </p>
            <p>
              <span className="font-medium text-blue-700 dark:text-blue-300">
                Tips:{" "}
              </span>
              {feedback.tips}
            </p>
            <p className="pt-1 font-medium">{feedback.encouragement}</p>
          </div>
        </section>
      )}

      {(error || speechError) && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error ??
            (speechError === "mic-denied"
              ? "Microphone permission was denied."
              : "A speech error occurred. Please try again.")}
        </div>
      )}
    </div>
  );
}
