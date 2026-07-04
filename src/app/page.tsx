"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ImageTrainer } from "@/components/ImageTrainer";
import { LoginPage } from "@/components/LoginPage";
import { LessonProvider, useLesson } from "@/context/LessonContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useDriveMode } from "@/hooks/useDriveMode";
import type { AppTab, DriveStatus } from "@/types/lesson";

/* ─── Status indicator with explicit interaction colors ─── */

const STATUS_CONFIG: Record<
  DriveStatus,
  { label: string; color: string; pulse: boolean; icon: ReactNode }
> = {
  idle: {
    label: "Ready to start",
    color: "bg-zinc-500",
    pulse: false,
    icon: <Volume2 className="h-8 w-8" aria-hidden />,
  },
  speaking: {
    label: "AI Teacher is speaking…",
    color: "bg-emerald-500",
    pulse: true,
    icon: <Volume2 className="h-8 w-8" aria-hidden />,
  },
  listening: {
    label: "Recording — speak now",
    color: "bg-red-500",
    pulse: true,
    icon: <Mic className="h-8 w-8" aria-hidden />,
  },
  "awaiting-done": {
    label: "Listening — tap Done when finished",
    color: "bg-red-500",
    pulse: true,
    icon: <Mic className="h-8 w-8" aria-hidden />,
  },
  processing: {
    label: "Processing your answer…",
    color: "bg-blue-500",
    pulse: true,
    icon: <Loader2 className="h-8 w-8 animate-spin" aria-hidden />,
  },
  error: {
    label: "Something went wrong",
    color: "bg-red-600",
    pulse: false,
    icon: <AlertCircle className="h-8 w-8" aria-hidden />,
  },
  "mic-denied": {
    label: "Microphone access denied",
    color: "bg-red-600",
    pulse: false,
    icon: <MicOff className="h-8 w-8" aria-hidden />,
  },
};

function StatusIndicator({ status }: { status: DriveStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="flex flex-col items-center gap-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="relative flex items-center justify-center">
        {config.pulse && (
          <span
            className={`absolute h-28 w-28 rounded-full ${config.color} animate-pulse-ring opacity-40`}
          />
        )}
        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg sm:h-28 sm:w-28 ${config.color}`}
        >
          {config.icon}
        </div>
      </div>
      <p className="text-center text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
        {config.label}
      </p>
    </div>
  );
}

/* ─── Shared card shell ─── */

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

/* ─── Text Config Workspace ─── */

function TextConfigWorkspace() {
  const {
    customTexts,
    addCustomText,
    removeCustomText,
    selectedTextId,
    setSelectedTextId,
    addCustomImage,
    removeCustomImage,
    customImages,
  } = useLesson();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imgTitle, setImgTitle] = useState("");
  const [explanation, setExplanation] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await addCustomText(title, content);
      setTitle("");
      setContent("");
    } catch {
      // Error surfaced via LessonContext apiError when loading fails; save errors are local.
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await addCustomText(file.name.replace(/\.[^.]+$/, ""), text);
    } catch {
      // noop
    }
    event.target.value = "";
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSaveImage = async () => {
    if (!preview || !explanation.trim()) return;
    try {
      await addCustomImage(imgTitle, preview, explanation);
      setImgTitle("");
      setExplanation("");
      setPreview(null);
    } catch {
      // noop
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-lg font-semibold sm:text-xl">
          Paste learning text
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-[var(--muted)]">
          Add long-form English readings for Aghas jan. The AI will ask
          comprehension questions in Drive mode.
        </p>

        <label className="mb-2 block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning news article"
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base"
        />

        <label className="mb-2 block text-sm font-medium">Reading text</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Paste your English reading text here…"
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base leading-relaxed"
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="min-h-12 rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            Save Text
          </button>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-6 py-3 font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Upload className="h-4 w-4" aria-hidden />
            Upload .txt
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => void handleFileUpload(e)}
            />
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold sm:text-xl">
          <ImagePlus className="h-5 w-5" aria-hidden />
          Image flashcard import
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Upload an image with the correct English explanation for flashcard
          practice.
        </p>

        <label className="mb-2 block text-sm font-medium">Image title</label>
        <input
          type="text"
          value={imgTitle}
          onChange={(e) => setImgTitle(e.target.value)}
          placeholder="e.g. Red apple on a table"
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
        />

        <label className="mb-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Upload className="h-4 w-4" aria-hidden />
          Choose image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        {preview && (
          <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="max-h-56 w-full object-contain"
            />
          </div>
        )}

        <label className="mb-2 block text-sm font-medium">
          Correct explanation
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="e.g. This is a red apple sitting on a wooden table."
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
        />

        <button
          type="button"
          onClick={handleSaveImage}
          disabled={!preview || !explanation.trim()}
          className="min-h-12 rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          Save Image Flashcard
        </button>
      </Card>

      <SavedItemsPanel
        texts={customTexts}
        images={customImages}
        selectedTextId={selectedTextId}
        onSelectText={setSelectedTextId}
        onRemoveText={removeCustomText}
        onRemoveImage={removeCustomImage}
      />
    </div>
  );
}

function SavedItemsPanel({
  texts,
  images,
  selectedTextId,
  onSelectText,
  onRemoveText,
  onRemoveImage,
}: {
  texts: { id: string; title: string; content: string }[];
  images: {
    id: string;
    title: string;
    imageSrc: string;
    standardExplanation: string;
  }[];
  selectedTextId: string | null;
  onSelectText: (id: string) => void;
  onRemoveText: (id: string) => void;
  onRemoveImage: (id: string) => void;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Saved library</h2>

      {texts.length === 0 && images.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing saved yet.</p>
      ) : (
        <div className="space-y-6">
          {texts.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">
                Texts ({texts.length})
              </h3>
              <ul className="space-y-2">
                {texts.map((text) => (
                  <li
                    key={text.id}
                    className={`rounded-xl border p-3 ${
                      selectedTextId === text.id
                        ? "border-[var(--accent)] bg-blue-50 dark:bg-blue-950"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectText(text.id)}
                        className="min-h-12 flex-1 text-left"
                      >
                        <p className="font-semibold">{text.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                          {text.content}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRemoveText(text.id)}
                        aria-label={`Delete ${text.title}`}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {images.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">
                Images ({images.length})
              </h3>
              <ul className="space-y-2">
                {images.map((img) => (
                  <li
                    key={img.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageSrc}
                      alt={img.title}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{img.title}</p>
                      <p className="truncate text-sm text-[var(--muted)]">
                        {img.standardExplanation}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemoveImage(img.id)}
                      aria-label={`Delete ${img.title}`}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── Drive Mode Workspace ─── */

function DriveModeWorkspace() {
  const {
    lesson,
    setLesson,
    lessons,
    currentItem,
    currentItemIndex,
    status,
    apiError,
    resetLesson,
    useCustomText,
    setUseCustomText,
    selectedTextId,
    setSelectedTextId,
    customTexts,
    selectedCustomText,
  } = useLesson();

  const {
    driveMode,
    toggleDriveMode,
    finishResponding,
    isAwaitingDone,
    liveTranscript,
    isSupported,
    speechError,
  } = useDriveMode();

  return (
    <div className="space-y-6">
      {!isSupported && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          Speech recognition is not supported in this browser. Please use Chrome
          or Safari on a device with a microphone.
        </div>
      )}

      <Card className="sm:p-8 lg:p-10">
        <StatusIndicator status={status} />

        <div className="mt-8 space-y-4 sm:mt-10">
          <button
            type="button"
            onClick={toggleDriveMode}
            disabled={!isSupported}
            aria-pressed={driveMode}
            className={`min-h-14 w-full rounded-2xl py-5 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-16 sm:py-6 sm:text-xl lg:text-2xl ${
              driveMode
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {driveMode ? "Stop Session" : "Start Session"}
          </button>

          {isAwaitingDone && (
            <button
              type="button"
              onClick={finishResponding}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-amber-600 active:scale-[0.98] sm:text-xl"
            >
              <CheckCircle2 className="h-6 w-6" aria-hidden />
              Done Responding
            </button>
          )}
        </div>

        {(isAwaitingDone || liveTranscript) && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-base leading-relaxed text-red-900 dark:bg-red-950 dark:text-red-100">
            {liveTranscript ||
              "Speak now — pauses are OK. Tap Done when finished."}
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setUseCustomText(false)}
            disabled={driveMode}
            className={`min-h-12 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              !useCustomText
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)]"
            }`}
          >
            Built-in lessons
          </button>
          <button
            type="button"
            onClick={() => setUseCustomText(true)}
            disabled={driveMode || customTexts.length === 0}
            className={`min-h-12 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              useCustomText
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)]"
            }`}
          >
            Custom imported text
          </button>
        </div>

        {!useCustomText ? (
          <>
            <label
              htmlFor="lesson-select"
              className="mb-2 block text-sm font-medium text-[var(--muted)]"
            >
              Lesson
            </label>
            <select
              id="lesson-select"
              value={lesson.id}
              disabled={driveMode}
              onChange={(e) => {
                const selected = lessons.find((l) => l.id === e.target.value);
                if (selected) {
                  setLesson(selected);
                  resetLesson();
                }
              }}
              className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base disabled:opacity-50"
            >
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {lesson.description}
            </p>
          </>
        ) : (
          <>
            <label
              htmlFor="text-select"
              className="mb-2 block text-sm font-medium text-[var(--muted)]"
            >
              Imported reading text
            </label>
            <select
              id="text-select"
              value={selectedTextId ?? ""}
              disabled={driveMode}
              onChange={(e) => setSelectedTextId(e.target.value || null)}
              className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base disabled:opacity-50"
            >
              {customTexts.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {selectedCustomText && (
              <p className="mt-3 line-clamp-3 text-sm text-[var(--muted)]">
                {selectedCustomText.content}
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-[var(--muted)]">
            {useCustomText
              ? "Current prompt"
              : `Question ${currentItemIndex + 1} of ${lesson.items.length}`}
          </h2>
          <button
            type="button"
            onClick={resetLesson}
            disabled={driveMode}
            aria-label="Reset lesson"
            className="flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm text-[var(--muted)] transition hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </button>
        </div>
        <p className="text-lg font-semibold leading-snug sm:text-xl lg:text-2xl">
          {useCustomText
            ? "Aghas jan, what is the main topic of this reading?"
            : `Aghas jan, ${currentItem.question}`}
        </p>
        {!useCustomText && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Hint: {currentItem.contextHint}
          </p>
        )}
      </Card>

      {(apiError || speechError) && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {apiError ??
            (speechError === "mic-denied"
              ? "Microphone permission was denied. Please allow microphone access in your browser settings and try again."
              : "A speech error occurred. Please try again.")}
        </div>
      )}
    </div>
  );
}

function DriveFeedbackPanel() {
  const { lastUserAnswer, lastAiFeedback, conversationHistory } = useLesson();

  if (!lastUserAnswer && !lastAiFeedback && conversationHistory.length === 0) {
    return (
      <Card className="h-full">
        <h2 className="mb-2 text-lg font-semibold">Feedback</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Start a session to see your answers, teacher feedback, and
          conversation history here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {lastUserAnswer && (
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Mic className="h-4 w-4" aria-hidden />
            Your answer
          </div>
          <p className="text-base font-medium leading-relaxed sm:text-lg">
            {lastUserAnswer}
          </p>
        </Card>
      )}

      {lastAiFeedback && (
        <Card>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Teacher feedback
          </div>
          <p className="text-base leading-relaxed sm:text-lg">
            {lastAiFeedback}
          </p>
        </Card>
      )}

      {conversationHistory.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-medium text-[var(--muted)]">
            Conversation
          </h2>
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {conversationHistory.map((msg) => (
              <li
                key={msg.id}
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                }`}
              >
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">
                  {msg.role === "user" ? "Aghas jan" : "Teacher"}
                </span>
                {msg.content}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ─── App header (mobile / tablet) ─── */

function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { activeTab } = useLesson();

  const titles: Record<AppTab, string> = {
    drive: "Drive / Listening",
    "text-import": "Text Config",
    "image-trainer": "Image Studio",
  };

  return (
    <div className="flex items-center justify-between gap-4 xl:hidden">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Aghas English
        </p>
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
          {titles[activeTab]}
        </h1>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {theme === "light" ? (
          <Moon className="h-5 w-5" aria-hidden />
        ) : (
          <Sun className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

/* ─── Main dashboard ─── */

function AppDashboard() {
  const { activeTab, isLoadingUserData } = useLesson();

  if (isLoadingUserData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted)]">
        Loading your saved lessons…
      </div>
    );
  }

  const sidePanel =
    activeTab === "drive" ? (
      <DriveFeedbackPanel />
    ) : activeTab === "image-trainer" ? (
      <Card className="h-full">
        <h2 className="mb-2 text-lg font-semibold">Practice tips</h2>
        <ul className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
          <li>Tap Random Image to load a flashcard.</li>
          <li>Describe what you see out loud, then tap Done Responding.</li>
          <li>
            Use the Translate button below to look up difficult words in
            Armenian.
          </li>
        </ul>
      </Card>
    ) : (
      <Card className="h-full">
        <h2 className="mb-2 text-lg font-semibold">How it works</h2>
        <ul className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
          <li>Paste or upload English reading texts here.</li>
          <li>Switch to Drive mode and select your imported text.</li>
          <li>
            The AI teacher will ask comprehension questions hands-free.
          </li>
        </ul>
      </Card>
    );

  return (
    <DashboardLayout header={<AppHeader />} sidePanel={sidePanel}>
      {activeTab === "drive" && <DriveModeWorkspace />}
      {activeTab === "text-import" && <TextConfigWorkspace />}
      {activeTab === "image-trainer" && <ImageTrainer />}
    </DashboardLayout>
  );
}

export default function HomePage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <ThemeProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
              Loading…
            </div>
          }
        >
          <LoginPage />
        </Suspense>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <LessonProvider>
        <AppDashboard />
      </LessonProvider>
    </ThemeProvider>
  );
}
