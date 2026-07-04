"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useId, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Headphones,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useLesson } from "@/context/LessonContext";
import { transcribeAudioFromDataUrl } from "@/lib/audio-transcribe";
import { readFileAsDataUrl } from "@/lib/ocr";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type QueueStatus =
  | "loaded"
  | "transcribing"
  | "ready"
  | "error"
  | "saving"
  | "saved";

interface ListeningQueueItem {
  id: string;
  fileName: string;
  audioDataUrl: string;
  title: string;
  transcript: string;
  status: QueueStatus;
  error?: string;
  expanded: boolean;
}

function fileNameToTitle(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function createQueueItem(
  file: File,
  audioDataUrl: string,
): ListeningQueueItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fileName: file.name,
    audioDataUrl,
    title: fileNameToTitle(file.name) || "Listening",
    transcript: "",
    status: "loaded",
    expanded: false,
  };
}

const STATUS_LABELS: Record<QueueStatus, string> = {
  loaded: "Waiting for AI transcript",
  transcribing: "AI is writing the spoken text…",
  ready: "Ready to save",
  error: "Could not transcribe — tap to type manually",
  saving: "Saving…",
  saved: "Saved to your library",
};

export function MultiListeningImport({
  onAllSaved,
}: {
  onAllSaved?: () => void;
}) {
  const { addCustomListening } = useLesson();
  const inputId = useId();

  const [queue, setQueue] = useState<ListeningQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscribingAll, setIsTranscribingAll] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [transcribeProgress, setTranscribeProgress] = useState<{
    current: number;
    total: number;
    message?: string;
  } | null>(null);
  const [saveProgress, setSaveProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const needsTranscriptionCount = queue.filter(
    (i) => i.status === "loaded" || i.status === "error",
  ).length;
  const pendingCount = queue.filter((i) => i.status === "loaded").length;
  const readyCount = queue.filter(
    (i) =>
      i.status === "ready" || (i.status === "error" && i.transcript.trim()),
  ).length;
  const savedCount = queue.filter((i) => i.status === "saved").length;
  const hasUnsaved = queue.some(
    (i) =>
      i.status !== "saved" &&
      i.status !== "saving" &&
      i.transcript.trim().length > 0,
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<ListeningQueueItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setGlobalError(null);
      const audioFiles = Array.from(files).filter(
        (f) =>
          f.type.startsWith("audio/") ||
          /\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i.test(f.name),
      );

      if (audioFiles.length === 0) {
        setGlobalError(
          "Please choose audio files (.mp3, .wav, .m4a, or similar).",
        );
        return;
      }

      const oversized = audioFiles.filter((f) => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        setGlobalError(
          `${oversized[0]!.name} is too large. Each file must be under 15 MB.`,
        );
        return;
      }

      const remaining = MAX_FILES - queue.length;
      if (remaining <= 0) {
        setGlobalError(`You can add up to ${MAX_FILES} audio files at a time.`);
        return;
      }

      const toAdd = audioFiles.slice(0, remaining);
      if (toAdd.length < audioFiles.length) {
        setGlobalError(
          `Only ${toAdd.length} more file${toAdd.length === 1 ? "" : "s"} could be added (limit ${MAX_FILES}).`,
        );
      }

      try {
        const newItems = await Promise.all(
          toAdd.map(async (file) => {
            const dataUrl = await readFileAsDataUrl(file);
            return createQueueItem(file, dataUrl);
          }),
        );
        setQueue((prev) => [...prev, ...newItems]);
      } catch {
        setGlobalError("Could not read one of the audio files. Please try again.");
      }
    },
    [queue.length],
  );

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

  const transcribeItem = async (item: ListeningQueueItem) => {
    updateItem(item.id, { status: "transcribing", error: undefined });
    try {
      const text = await transcribeAudioFromDataUrl(
        item.audioDataUrl,
        item.fileName,
        (message) => {
          setTranscribeProgress((prev) =>
            prev ? { ...prev, message } : prev,
          );
        },
      );
      updateItem(item.id, {
        status: "ready",
        transcript: text,
        title: item.title || fileNameToTitle(item.fileName),
      });
    } catch (err) {
      updateItem(item.id, {
        status: "error",
        error:
          err instanceof Error ? err.message : "Failed to transcribe audio.",
        expanded: true,
      });
    }
  };

  const transcribeAll = async () => {
    const toProcess = queue.filter(
      (i) => i.status === "loaded" || i.status === "error",
    );
    if (toProcess.length === 0) return;

    setIsTranscribingAll(true);
    setGlobalError(null);

    for (let i = 0; i < toProcess.length; i++) {
      setTranscribeProgress({
        current: i + 1,
        total: toProcess.length,
        message: `Processing ${toProcess[i]!.fileName}…`,
      });
      await transcribeItem(toProcess[i]!);
    }

    setTranscribeProgress(null);
    setIsTranscribingAll(false);
  };

  const saveItem = async (item: ListeningQueueItem) => {
    if (!item.transcript.trim()) return;
    updateItem(item.id, { status: "saving", error: undefined });
    try {
      await addCustomListening(
        item.title.trim() || fileNameToTitle(item.fileName),
        item.transcript.trim(),
        item.audioDataUrl,
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
        (i.status === "error" && i.transcript.trim()),
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
    onAllSaved?.();
  };

  return (
    <section className="app-card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-indigo-50 to-purple-50 p-5 dark:from-indigo-950/40 dark:to-purple-950/30 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md sm:h-14 sm:w-14">
            <Headphones className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Add many listenings at once
            </h2>
            <p className="mt-1.5 text-base leading-relaxed text-[var(--muted)]">
              Choose audio recordings from your phone or computer. AI writes the
              full spoken text for each file. Then save them all for listening
              and practice.
            </p>
          </div>
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-3 sm:gap-3">
          {[
            { step: 1, text: "Add your audio files" },
            { step: 2, text: "Transcribe all with AI" },
            { step: 3, text: "Save listenings" },
          ].map(({ step, text }) => (
            <li
              key={step}
              className="flex items-center gap-2.5 rounded-xl border border-indigo-200/80 bg-white/70 px-3 py-2.5 dark:border-indigo-800/60 dark:bg-zinc-900/50"
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-5 transition sm:p-8 ${
            isDragging
              ? "border-[var(--accent)] bg-indigo-50 dark:bg-indigo-950/30"
              : "border-[var(--border)] bg-[var(--background)]"
          }`}
        >
          <p className="mb-4 text-center text-base font-medium sm:text-lg">
            Tap below to add audio files
          </p>

          <label
            htmlFor={inputId}
            className="mx-auto flex min-h-[3.75rem] max-w-md cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[var(--accent-hover)] active:scale-[0.98] sm:min-h-16 sm:text-lg"
          >
            <Upload className="h-6 w-6 shrink-0" aria-hidden />
            Choose audio files
          </label>

          <p className="mt-4 text-center text-sm leading-relaxed text-[var(--muted)]">
            .mp3, .wav, .m4a — up to 15 MB each.
            <br className="hidden sm:inline" />
            {" "}Select many files at once. On a computer, drag files here.
          </p>

          <input
            id={inputId}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.aac"
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

        {queue.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-white">
                {queue.length} file{queue.length === 1 ? "" : "s"}
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {pendingCount} need transcript
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
                onClick={() => void transcribeAll()}
                disabled={
                  isTranscribingAll || isSavingAll || needsTranscriptionCount === 0
                }
                className="inline-flex min-h-[3.75rem] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--accent)] bg-indigo-50 px-5 py-4 text-base font-bold text-[var(--accent)] transition hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:hover:bg-indigo-900 sm:min-h-16 sm:text-lg"
              >
                {isTranscribingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {transcribeProgress
                      ? `Transcribing ${transcribeProgress.current} of ${transcribeProgress.total}…`
                      : "Transcribing…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" aria-hidden />
                    Transcribe all with AI
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void saveAllReady()}
                disabled={isSavingAll || isTranscribingAll || !hasUnsaved}
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
                    Save all listenings
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

            {transcribeProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm font-medium text-[var(--muted)]">
                  <span>
                    {transcribeProgress.message ?? "Transcribing audio"}
                  </span>
                  <span>
                    {transcribeProgress.current} / {transcribeProgress.total}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{
                      width: `${(transcribeProgress.current / transcribeProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  AI runs on your device — free, no credits needed. Large batches
                  may take a few minutes.
                </p>
              </div>
            )}
          </div>
        )}

        {queue.length > 0 && (
          <ul className="grid gap-4 lg:grid-cols-1">
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
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-indigo-50 dark:bg-indigo-950">
                    <Headphones className="h-6 w-6 text-[var(--accent)]" />
                    {item.status === "transcribing" && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                    {item.status === "saved" && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-600/70">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold sm:text-lg">
                      {item.title}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{item.fileName}</p>
                    <p
                      className={`mt-0.5 text-sm leading-snug ${
                        item.status === "error"
                          ? "text-red-600 dark:text-red-400"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {item.error ?? STATUS_LABELS[item.status]}
                    </p>
                    {!item.expanded && item.transcript && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed">
                        {item.transcript}
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

                {item.expanded && item.status !== "saved" && (
                  <div className="border-t border-[var(--border)] p-4 sm:p-5">
                    <audio
                      controls
                      src={item.audioDataUrl}
                      className="mb-4 w-full"
                      preload="metadata"
                    />

                    <label className="mb-2 block text-base font-semibold">
                      Listening name
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(item.id, { title: e.target.value })
                      }
                      className="app-input mb-4 text-base"
                      placeholder="e.g. Morning news recording"
                    />

                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-base font-semibold">
                        Spoken text (transcript)
                      </label>
                      {(item.status === "loaded" || item.status === "error") && (
                        <button
                          type="button"
                          onClick={() => void transcribeItem(item)}
                          disabled={isTranscribingAll}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-indigo-50 disabled:opacity-50 dark:hover:bg-indigo-950"
                        >
                          <Sparkles className="h-4 w-4" aria-hidden />
                          Transcribe with AI
                        </button>
                      )}
                    </div>
                    <textarea
                      value={item.transcript}
                      onChange={(e) =>
                        updateItem(item.id, {
                          transcript: e.target.value,
                          status:
                            item.status === "error" && e.target.value.trim()
                              ? "ready"
                              : item.status,
                        })
                      }
                      rows={5}
                      placeholder="Full text of what is spoken. Tap Transcribe with AI or type manually."
                      className="app-input mb-4 text-base leading-relaxed"
                    />

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void saveItem(item)}
                        disabled={
                          !item.transcript.trim() ||
                          item.status === "saving" ||
                          item.status === "transcribing"
                        }
                        className="app-btn-primary min-h-12 flex-1 py-3 text-base"
                      >
                        {item.status === "saving" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save this listening"
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
                      Saved! Go to Listen to play it, or Study and Practice.
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
            No audio files added yet. Use the button above to get started.
          </p>
        )}
      </div>
    </section>
  );
}
