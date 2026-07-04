"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Mic,
  RefreshCw,
  Shuffle,
  Volume2,
} from "lucide-react";
import { SavedImagesLibrary } from "@/components/SavedLibrary";
import { useLesson } from "@/context/LessonContext";
import { useSpeechFixed } from "@/hooks/useSpeechFixed";
import { buildSpokenFeedback } from "@/lib/chat-utils";
import type { ChatResponseBody, LessonImage } from "@/types/lesson";

type TrainerMode = "study" | "practice";

function pickRandomImage(
  images: LessonImage[],
  excludeId?: string,
): LessonImage | null {
  const pool = excludeId
    ? images.filter((img) => img.id !== excludeId)
    : images;
  const list = pool.length > 0 ? pool : images;
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

export function ImageTrainer() {
  const { customImages, removeCustomImage } = useLesson();
  const [mode, setMode] = useState<TrainerMode>("study");
  const [currentImage, setCurrentImage] = useState<LessonImage | null>(null);
  const [feedback, setFeedback] = useState<ChatResponseBody | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

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
  } = useSpeechFixed({ autoFinishOnSilence: true, silenceThresholdMs: 2500 });

  const hasImages = customImages.length > 0;

  const displayTranscript = useMemo(() => {
    return liveTranscript || "Speak now — pauses are OK…";
  }, [liveTranscript]);

  const selectImage = useCallback(
    (image: LessonImage | null) => {
      abortListening();
      setFeedback(null);
      setError(null);
      setShowExplanation(false);
      setCurrentImage(image);
    },
    [abortListening],
  );

  const loadRandomCard = useCallback(() => {
    selectImage(pickRandomImage(customImages, currentImage?.id));
  }, [currentImage?.id, customImages, selectImage]);

  const startPracticeCard = useCallback(() => {
    const image = pickRandomImage(customImages);
    selectImage(image);
    if (!image) return;

    const prompt =
      "Aghas jan, look at this image and tell me what you see. Take your time.";
    speak(prompt);
  }, [customImages, selectImage, speak]);

  const readExplanation = useCallback(() => {
    if (!currentImage) return;
    speak(currentImage.standardExplanation);
  }, [currentImage, speak]);

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
      speak(buildSpokenFeedback(result, false));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setIsGrading(false);
    }
  }, [currentImage, finishListening, speak]);

  useEffect(() => {
    if (hasImages && !currentImage && customImages[0]) {
      setCurrentImage(customImages[0]);
    }
  }, [hasImages, currentImage, customImages]);

  if (!hasImages) {
    return (
      <div className="app-card border-dashed p-6 text-center sm:p-8">
        <ImageIcon className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]" />
        <h2 className="text-lg font-semibold sm:text-xl">No flashcard images yet</h2>
        <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
          Add photo flashcards in Text Config (you can upload many at once),
          then study and practice here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Mode switcher */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5">
        <button
          type="button"
          onClick={() => {
            setMode("study");
            abortListening();
            setFeedback(null);
          }}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition sm:text-base ${
            mode === "study"
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "text-[var(--muted)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Study
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("practice");
            abortListening();
            setFeedback(null);
          }}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition sm:text-base ${
            mode === "practice"
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "text-[var(--muted)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Mic className="h-4 w-4" aria-hidden />
          Practice
        </button>
      </div>

      <SavedImagesLibrary
        images={customImages}
        selectedImageId={currentImage?.id ?? null}
        onSelectImage={(id) => {
          const img = customImages.find((i) => i.id === id);
          if (img) selectImage(img);
        }}
        onRemoveImage={removeCustomImage}
      />

      {mode === "study" && currentImage && (
        <section className="app-card space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-lg font-semibold">{currentImage.title}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadRandomCard}
                className="app-btn-secondary min-h-11 flex-1 px-4 py-2 text-sm sm:flex-none"
              >
                <Shuffle className="h-4 w-4" aria-hidden />
                Random
              </button>
              <button
                type="button"
                onClick={readExplanation}
                disabled={isSpeaking}
                className="app-btn-primary min-h-11 flex-1 px-4 py-2 text-sm sm:flex-none"
              >
                <Volume2 className="h-4 w-4" aria-hidden />
                Read aloud
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-zinc-100 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.imageSrc}
              alt={currentImage.title}
              className="mx-auto max-h-[50vh] w-full object-contain sm:max-h-[45vh]"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowExplanation((v) => !v)}
              className="mb-3 min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-left text-sm font-semibold sm:w-auto"
            >
              {showExplanation ? "Hide" : "Show"} full AI explanation
            </button>

            {showExplanation && (
              <article className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-base leading-relaxed dark:border-blue-900 dark:bg-blue-950">
                {currentImage.standardExplanation}
              </article>
            )}
          </div>

          <p className="text-sm text-[var(--muted)]">
            Study the image and explanation first. Switch to Practice when ready
            to describe it out loud.
          </p>
        </section>
      )}

      {mode === "practice" && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={startPracticeCard}
              className="app-btn-primary min-h-14 flex-1 py-4 text-base sm:flex-none"
            >
              <Shuffle className="h-5 w-5" aria-hidden />
              Start practice
            </button>
            {currentImage && (
              <button
                type="button"
                onClick={loadRandomCard}
                className="app-btn-secondary min-h-14 flex-1 py-4 sm:flex-none"
              >
                <RefreshCw className="h-5 w-5" aria-hidden />
                Next
              </button>
            )}
          </div>

          {currentImage && (
            <section className="app-card p-4 sm:p-5">
              <h2 className="mb-3 text-lg font-semibold">{currentImage.title}</h2>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-zinc-100 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage.imageSrc}
                  alt={currentImage.title}
                  className="mx-auto max-h-[40vh] w-full object-contain"
                />
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Describe what you see. The app detects when you finish speaking.
              </p>
            </section>
          )}

          {currentImage && (
            <section className="app-card p-4 sm:p-5">
              {!isAwaitingDone ? (
                <button
                  type="button"
                  onClick={startMic}
                  disabled={!isSupported || isGrading || isSpeaking}
                  className="mb-4 inline-flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50 sm:min-h-14 sm:text-lg"
                >
                  <Mic className="h-6 w-6" aria-hidden />
                  Start speaking
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitDescription()}
                  disabled={isGrading}
                  className="mb-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-4 text-lg font-bold text-white disabled:opacity-50"
                >
                  {isGrading ? (
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                  )}
                  Done speaking
                </button>
              )}

              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-base leading-relaxed text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                {displayTranscript}
              </p>
            </section>
          )}

          {feedback && (
            <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950 sm:p-5">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                Teacher feedback
              </h3>
              <div className="space-y-2 text-sm leading-relaxed sm:text-base">
                {feedback.shouldAdvance ? (
                  <p>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      Correct:{" "}
                    </span>
                    {feedback.validation}
                  </p>
                ) : (
                  <p>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      What to fix:{" "}
                    </span>
                    {feedback.corrections}
                  </p>
                )}
                {feedback.tips && (
                  <p>
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      Tips:{" "}
                    </span>
                    {feedback.tips}
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {(error || speechError) && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
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
