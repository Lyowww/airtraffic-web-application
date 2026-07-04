"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useLesson } from "@/context/LessonContext";
import { describeImage } from "@/lib/image-ai";
import { readFileAsDataUrl } from "@/lib/ocr";

const MAX_IMAGES = 30;

type QueueStatus =
  | "loaded"
  | "generating"
  | "ready"
  | "error"
  | "saving"
  | "saved";

interface ImageQueueItem {
  id: string;
  fileName: string;
  preview: string;
  title: string;
  explanation: string;
  status: QueueStatus;
  error?: string;
  expanded: boolean;
}

function fileNameToTitle(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function createQueueItem(file: File, preview: string): ImageQueueItem {
  const fileName = file.name.replace(/\.[^.]+$/, "");
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fileName,
    preview,
    title: fileNameToTitle(file.name) || "Flashcard image",
    explanation: "",
    status: "loaded",
    expanded: false,
  };
}

const STATUS_LABELS: Record<QueueStatus, string> = {
  loaded: "Waiting for AI explanation",
  generating: "AI is writing explanation…",
  ready: "Ready to save",
  error: "Could not generate — tap to edit manually",
  saving: "Saving…",
  saved: "Saved to your library",
};

export function MultiImageFlashcardImport() {
  const { addCustomImage } = useLesson();
  const inputId = useId();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<ImageQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [generateProgress, setGenerateProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const needsGenerationCount = queue.filter(
    (i) => i.status === "loaded" || i.status === "error",
  ).length;
  const pendingCount = queue.filter((i) => i.status === "loaded").length;
  const readyCount = queue.filter(
    (i) => i.status === "ready" || (i.status === "error" && i.explanation.trim()),
  ).length;
  const savedCount = queue.filter((i) => i.status === "saved").length;
  const hasUnsaved = queue.some(
    (i) =>
      i.status !== "saved" &&
      i.status !== "saving" &&
      i.explanation.trim().length > 0,
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<ImageQueueItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setGlobalError(null);
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      setGlobalError("Please choose image files (JPG, PNG, or similar).");
      return;
    }

    const remaining = MAX_IMAGES - queue.length;
    if (remaining <= 0) {
      setGlobalError(`You can add up to ${MAX_IMAGES} images at a time.`);
      return;
    }

    const toAdd = imageFiles.slice(0, remaining);
    if (toAdd.length < imageFiles.length) {
      setGlobalError(
        `Only ${toAdd.length} more image${toAdd.length === 1 ? "" : "s"} could be added (limit ${MAX_IMAGES}).`,
      );
    }

    try {
      const newItems = await Promise.all(
        toAdd.map(async (file) => {
          const preview = await readFileAsDataUrl(file);
          return createQueueItem(file, preview);
        }),
      );
      setQueue((prev) => [...prev, ...newItems]);
    } catch {
      setGlobalError("Could not read one of the images. Please try again.");
    }
  }, [queue.length]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) void addFiles(files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearSaved = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "saved"));
  };

  const generateExplanation = async (item: ImageQueueItem) => {
    updateItem(item.id, { status: "generating", error: undefined });
    try {
      const description = await describeImage(item.preview);
      updateItem(item.id, {
        status: "ready",
        explanation: description,
        title: item.title || fileNameToTitle(item.fileName),
      });
    } catch (err) {
      updateItem(item.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate explanation.",
        expanded: true,
      });
    }
  };

  const generateAllExplanations = async () => {
    const toProcess = queue.filter(
      (i) => i.status === "loaded" || i.status === "error",
    );
    if (toProcess.length === 0) return;

    setIsGeneratingAll(true);
    setGlobalError(null);
    setGenerateProgress({ current: 0, total: toProcess.length });

    for (let i = 0; i < toProcess.length; i++) {
      setGenerateProgress({ current: i + 1, total: toProcess.length });
      await generateExplanation(toProcess[i]!);
    }

    setGenerateProgress(null);
    setIsGeneratingAll(false);
  };

  const saveItem = async (item: ImageQueueItem) => {
    if (!item.explanation.trim()) return;
    updateItem(item.id, { status: "saving", error: undefined });
    try {
      await addCustomImage(
        item.title.trim() || item.fileName,
        item.preview,
        item.explanation.trim(),
      );
      updateItem(item.id, { status: "saved", expanded: false });
    } catch (err) {
      updateItem(item.id, {
        status: "ready",
        error: err instanceof Error ? err.message : "Failed to save.",
        expanded: true,
      });
    }
  };

  const saveAllReady = async () => {
    const toSave = queue.filter(
      (i) =>
        i.status === "ready" ||
        (i.status === "error" && i.explanation.trim()),
    );
    if (toSave.length === 0) return;

    setIsSavingAll(true);
    setGlobalError(null);
    setSaveProgress({ current: 0, total: toSave.length });

    for (let i = 0; i < toSave.length; i++) {
      setSaveProgress({ current: i + 1, total: toSave.length });
      await saveItem(toSave[i]!);
    }

    setSaveProgress(null);
    setIsSavingAll(false);
  };

  return (
    <section className="app-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:from-blue-950/40 dark:to-indigo-950/30 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md sm:h-14 sm:w-14">
            <ImagePlus className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Image flashcards — add many at once
            </h2>
            <p className="mt-1.5 text-base leading-relaxed text-[var(--muted)]">
              Choose photos from your phone or computer. AI writes a full
              English explanation for each one. Then save them all for practice.
            </p>
          </div>
        </div>

        {/* Step guide */}
        <ol className="mt-5 grid gap-2 sm:grid-cols-3 sm:gap-3">
          {[
            { step: 1, text: "Add your photos" },
            { step: 2, text: "Generate explanations" },
            { step: 3, text: "Save flashcards" },
          ].map(({ step, text }) => (
            <li
              key={step}
              className="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-white/70 px-3 py-2.5 dark:border-blue-800/60 dark:bg-zinc-900/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                {step}
              </span>
              <span className="text-sm font-semibold leading-snug sm:text-base">
                {text}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {/* Drop zone & pickers */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-5 transition sm:p-8 ${
            isDragging
              ? "border-[var(--accent)] bg-blue-50 dark:bg-blue-950/30"
              : "border-[var(--border)] bg-[var(--background)]"
          }`}
        >
          <p className="mb-4 text-center text-base font-medium sm:text-lg">
            Tap a button below to add images
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-[3.75rem] flex-1 items-center justify-center gap-3 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4 text-base font-bold text-[var(--accent)] transition active:scale-[0.98] sm:min-h-16 sm:max-w-xs sm:flex-none sm:text-lg"
            >
              <Camera className="h-6 w-6 shrink-0" aria-hidden />
              Take a photo
            </button>

            <label
              htmlFor={inputId}
              className="flex min-h-[3.75rem] flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[var(--accent-hover)] active:scale-[0.98] sm:min-h-16 sm:max-w-xs sm:flex-none sm:text-lg"
            >
              <Upload className="h-6 w-6 shrink-0" aria-hidden />
              Choose photos
            </label>
          </div>

          <p className="mt-4 text-center text-sm leading-relaxed text-[var(--muted)]">
            You can select many photos at once from your gallery.
            <br className="hidden sm:inline" />
            {" "}On a computer, you can also drag images here.
          </p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={galleryInputRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {globalError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="text-base leading-relaxed">{globalError}</p>
          </div>
        )}

        {/* Queue summary & batch actions */}
        {queue.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-white">
                {queue.length} photo{queue.length === 1 ? "" : "s"}
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {pendingCount} need explanation
                </span>
              )}
              {readyCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {readyCount} ready to save
                </span>
              )}
              {savedCount > 0 && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  {savedCount} saved
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void generateAllExplanations()}
                disabled={
                  isGeneratingAll ||
                  isSavingAll ||
                  needsGenerationCount === 0
                }
                className="inline-flex min-h-[3.75rem] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--accent)] bg-blue-50 px-5 py-4 text-base font-bold text-[var(--accent)] transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950 dark:hover:bg-blue-900 sm:min-h-16 sm:text-lg"
              >
                {isGeneratingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {generateProgress
                      ? `Writing ${generateProgress.current} of ${generateProgress.total}…`
                      : "Generating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" aria-hidden />
                    Generate all explanations
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void saveAllReady()}
                disabled={isSavingAll || isGeneratingAll || !hasUnsaved}
                className="app-btn-primary min-h-[3.75rem] flex-1 py-4 text-base sm:min-h-16 sm:text-lg"
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {saveProgress
                      ? `Saving ${saveProgress.current} of ${saveProgress.total}…`
                      : "Saving…"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                    Save all flashcards
                  </>
                )}
              </button>

              {savedCount > 0 && savedCount === queue.length && (
                <button
                  type="button"
                  onClick={clearSaved}
                  className="app-btn-secondary min-h-12 w-full sm:w-auto"
                >
                  Clear list
                </button>
              )}
            </div>

            {generateProgress && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-sm font-medium text-[var(--muted)]">
                  <span>Generating explanations</span>
                  <span>
                    {generateProgress.current} / {generateProgress.total}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{
                      width: `${(generateProgress.current / generateProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image cards grid */}
        {queue.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {queue.map((item, index) => (
              <li
                key={item.id}
                className={`overflow-hidden rounded-2xl border-2 transition ${
                  item.status === "saved"
                    ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                    : item.status === "ready"
                      ? "border-[var(--accent)]/40 bg-[var(--card)]"
                      : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                {/* Card header — always visible */}
                <button
                  type="button"
                  onClick={() =>
                    updateItem(item.id, { expanded: !item.expanded })
                  }
                  className="flex w-full items-center gap-3 p-3 text-left sm:p-4"
                  aria-expanded={item.expanded}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-[var(--muted)] dark:bg-zinc-800">
                    {index + 1}
                  </span>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-zinc-100 dark:bg-zinc-900 sm:h-20 sm:w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    {item.status === "generating" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    {item.status === "saved" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/70">
                        <CheckCircle2 className="h-7 w-7 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold sm:text-lg">
                      {item.title}
                    </p>
                    <p
                      className={`mt-0.5 text-sm leading-snug ${
                        item.status === "error"
                          ? "text-red-600 dark:text-red-400"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {item.error ?? STATUS_LABELS[item.status]}
                    </p>
                    {!item.expanded && item.explanation && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                  {item.expanded ? (
                    <ChevronUp
                      className="h-5 w-5 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                  ) : (
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                  )}
                </button>

                {/* Expanded edit panel */}
                {item.expanded && item.status !== "saved" && (
                  <div className="border-t border-[var(--border)] p-4 sm:p-5">
                    <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt={item.title}
                        className="mx-auto max-h-48 w-full object-contain sm:max-h-56"
                      />
                    </div>

                    <label className="mb-2 block text-base font-semibold">
                      Flashcard name
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(item.id, { title: e.target.value })
                      }
                      className="app-input mb-4 text-base"
                      placeholder="e.g. Red apple on table"
                    />

                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-base font-semibold">
                        English explanation
                      </label>
                      {(item.status === "loaded" ||
                        item.status === "error") && (
                        <button
                          type="button"
                          onClick={() => void generateExplanation(item)}
                          disabled={isGeneratingAll}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4" aria-hidden />
                          Generate with AI
                        </button>
                      )}
                    </div>
                    <textarea
                      value={item.explanation}
                      onChange={(e) =>
                        updateItem(item.id, {
                          explanation: e.target.value,
                          status:
                            item.status === "error" && e.target.value.trim()
                              ? "ready"
                              : item.status,
                        })
                      }
                      rows={4}
                      placeholder="Describe what is in the photo in clear English. You can type yourself or tap Generate with AI."
                      className="app-input mb-4 text-base leading-relaxed"
                    />

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void saveItem(item)}
                        disabled={
                          !item.explanation.trim() ||
                          item.status === "saving" ||
                          item.status === "generating"
                        }
                        className="app-btn-primary min-h-12 flex-1 py-3 text-base"
                      >
                        {item.status === "saving" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save this flashcard"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-base font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {item.expanded && item.status === "saved" && (
                  <div className="border-t border-[var(--border)] p-4">
                    <p className="mb-3 text-base leading-relaxed text-emerald-700 dark:text-emerald-300">
                      Saved! Open Image Studio to study and practice this
                      flashcard.
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--muted)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Remove from list
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {queue.length === 0 && (
          <p className="text-center text-base leading-relaxed text-[var(--muted)]">
            No photos added yet. Use the buttons above to get started.
          </p>
        )}
      </div>
    </section>
  );
}
