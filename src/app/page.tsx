"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  RotateCcw,
  Sun,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ImageTrainer } from "@/components/ImageTrainer";
import { ListeningHub, ListeningHubSidePanel } from "@/components/ListeningHub";
import { LoginPage } from "@/components/LoginPage";
import { MultiImageFlashcardImport } from "@/components/MultiImageFlashcardImport";
import { OcrImageImport } from "@/components/OcrImageImport";
import { SavedTextsLibrary } from "@/components/SavedLibrary";
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
    label: "Listening — speak now, pause to finish",
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
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg sm:h-24 sm:w-24 md:h-28 md:w-28 ${config.color}`}
        >
          {config.icon}
        </div>
      </div>
      <p className="max-w-xs text-center text-lg font-semibold tracking-tight sm:max-w-sm sm:text-xl md:text-2xl">
        {config.label}
      </p>
    </div>
  );
}

/* ─── Shared card shell ─── */

function Card({
  children,
  className = "",
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <section
      className={`${elevated ? "app-card-elevated" : "app-card"} p-4 sm:p-5 lg:p-6 ${className}`}
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
  } = useLesson();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isUploadingTexts, setIsUploadingTexts] = useState(false);
  const [textUploadProgress, setTextUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

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
    const files = event.target.files;
    if (!files?.length) return;

    const txtFiles = Array.from(files).filter(
      (f) =>
        f.name.endsWith(".txt") ||
        f.type === "text/plain" ||
        f.type === "",
    );
    if (txtFiles.length === 0) return;

    setIsUploadingTexts(true);
    setTextUploadProgress({ current: 0, total: txtFiles.length });

    for (let i = 0; i < txtFiles.length; i++) {
      const file = txtFiles[i]!;
      setTextUploadProgress({ current: i + 1, total: txtFiles.length });
      try {
        const text = await file.text();
        if (text.trim()) {
          await addCustomText(file.name.replace(/\.[^.]+$/, ""), text);
        }
      } catch {
        // continue with remaining files
      }
    }

    setTextUploadProgress(null);
    setIsUploadingTexts(false);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-xl font-bold sm:text-2xl">
          Paste learning text
        </h2>
        <p className="mb-5 text-base leading-relaxed text-[var(--muted)]">
          Add English reading texts for Aghas jan. You can paste one text, or
          upload many .txt files at once. The AI teacher will ask comprehension
          questions in Drive mode.
        </p>

        <label className="mb-2 block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning news article"
          className="app-input mb-4"
        />

        <label className="mb-2 block text-sm font-medium">Reading text</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Paste your English reading text here…"
          className="app-input mb-4 leading-relaxed sm:rows-10"
        />

        <OcrImageImport
          onTextExtracted={(text) =>
            setContent((prev) => (prev ? `${prev}\n\n${text}` : text))
          }
          label="Scan text from photo"
          hint="Photograph or upload an image — extracted text fills the reading field above."
        />

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="app-btn-primary min-h-14 w-full text-base sm:w-auto sm:text-lg"
          >
            Save this text
          </button>
          <label className="app-btn-secondary min-h-14 w-full cursor-pointer text-base sm:w-auto sm:text-lg">
            {isUploadingTexts ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {textUploadProgress
                  ? `Uploading ${textUploadProgress.current} of ${textUploadProgress.total}…`
                  : "Uploading…"}
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" aria-hidden />
                Upload .txt files
              </>
            )}
            <input
              type="file"
              accept=".txt,text/plain"
              multiple
              className="hidden"
              disabled={isUploadingTexts}
              onChange={(e) => void handleFileUpload(e)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Tip: You can select many .txt files at once from your phone or
          computer.
        </p>
      </Card>

      <MultiImageFlashcardImport />

      <SavedTextsLibrary
        texts={customTexts}
        selectedTextId={selectedTextId}
        onSelectText={setSelectedTextId}
        onRemoveText={removeCustomText}
      />
    </div>
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

      <Card elevated className="sm:p-6 lg:p-8">
        <StatusIndicator status={status} />

        <div className="mt-5 space-y-2.5 sm:mt-7 sm:space-y-3">
          <button
            type="button"
            onClick={toggleDriveMode}
            disabled={!isSupported}
            aria-pressed={driveMode}
            className={`min-h-[3.75rem] w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-16 sm:py-5 sm:text-lg md:text-xl ${
              driveMode
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {driveMode ? "Stop session" : "Start hands-free session"}
          </button>

          {isAwaitingDone && (
            <button
              type="button"
              onClick={finishResponding}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-bold text-white shadow-lg transition hover:bg-amber-600 active:scale-[0.98] sm:text-lg"
            >
              <CheckCircle2 className="h-6 w-6" aria-hidden />
              Done speaking
            </button>
          )}
        </div>

        {(isAwaitingDone || liveTranscript) && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-center text-sm leading-relaxed text-red-900 dark:bg-red-950 dark:text-red-100 sm:text-base">
            {liveTranscript ||
              "Speak now — pauses are OK. The app detects when you finish."}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-[var(--muted)] sm:text-sm">
          Hands-free: AI speaks, listens for your full answer, then gives honest
          feedback before the next question.
        </p>
      </Card>

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--background)] p-1">
          <button
            type="button"
            onClick={() => setUseCustomText(false)}
            disabled={driveMode}
            className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:min-h-12 sm:text-sm ${
              !useCustomText
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Built-in
          </button>
          <button
            type="button"
            onClick={() => setUseCustomText(true)}
            disabled={driveMode || customTexts.length === 0}
            className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:min-h-12 sm:text-sm ${
              useCustomText
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Custom text
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
              className="app-input min-h-12 disabled:opacity-50"
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
              className="app-input min-h-12 disabled:opacity-50"
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
        <p className="text-base font-semibold leading-snug sm:text-lg md:text-xl lg:text-2xl">
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
  const [menuOpen, setMenuOpen] = useState(false);

  const titles: Record<AppTab, string> = {
    drive: "Drive Mode",
    "listening-hub": "Listening Hub",
    "text-import": "Text Config",
    "image-trainer": "Image Studio",
  };

  const subtitles: Record<AppTab, string> = {
    drive: "Hands-free AI practice",
    "listening-hub": "Import · Listen · Study · Practice",
    "text-import": "Add readings & flashcards",
    "image-trainer": "Study & describe images",
  };

  return (
    <div className="flex items-center justify-between gap-3 md:hidden">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Aghas English
        </p>
        <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
          {titles[activeTab]}
        </h1>
        <p className="truncate text-xs text-[var(--muted)]">
          {subtitles[activeTab]}
        </p>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="App menu"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition active:scale-95"
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[11rem] animate-fade-in-up overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setMenuOpen(false);
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-sm font-medium transition hover:bg-[var(--accent-soft)]"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" aria-hidden />
                ) : (
                  <Sun className="h-4 w-4" aria-hidden />
                )}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
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

  const sidePanelTitles: Record<AppTab, string> = {
    drive: "Feedback & conversation",
    "listening-hub": "Listening tips",
    "text-import": "How it works",
    "image-trainer": "Practice tips",
  };

  const sidePanel =
    activeTab === "drive" ? (
      <DriveFeedbackPanel />
    ) : activeTab === "listening-hub" ? (
      <ListeningHubSidePanel />
    ) : activeTab === "image-trainer" ? (
      <div>
        <h2 className="mb-2 text-base font-semibold sm:text-lg">
          Practice tips
        </h2>
        <ul className="space-y-2.5 text-sm leading-relaxed text-[var(--muted)]">
          <li className="flex gap-2">
            <span className="text-[var(--accent)]">•</span>
            Tap Random Image to load a flashcard.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--accent)]">•</span>
            Describe what you see out loud, then tap Done Responding.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--accent)]">•</span>
            Use the Translate button to look up difficult words.
          </li>
        </ul>
      </div>
    ) : (
      <div>
        <h2 className="mb-2 text-base font-semibold sm:text-lg">
          How it works
        </h2>
        <ul className="space-y-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              1
            </span>
            Paste text, upload many .txt files, or add photo flashcards below.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              2
            </span>
            For photos: tap Generate all explanations, then Save all
            flashcards.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              3
            </span>
            Open Drive mode for readings, or Image Studio for flashcards.
          </li>
        </ul>
      </div>
    );

  return (
    <DashboardLayout
      header={<AppHeader />}
      sidePanel={sidePanel}
      sidePanelTitle={sidePanelTitles[activeTab]}
    >
      {activeTab === "drive" && <DriveModeWorkspace />}
      {activeTab === "listening-hub" && <ListeningHub />}
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
