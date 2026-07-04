"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Headphones,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { OcrImageImport } from "@/components/OcrImageImport";
import { SavedListeningsLibrary } from "@/components/SavedLibrary";
import { useLesson } from "@/context/LessonContext";
import { useListeningPractice } from "@/hooks/useListeningPractice";
import { readFileAsDataUrl } from "@/lib/ocr";
import type { ListeningHubView } from "@/types/lesson";

const STEPS: {
  id: ListeningHubView;
  label: string;
  short: string;
  icon: typeof Plus;
}[] = [
  { id: "import", label: "Import", short: "1", icon: Plus },
  { id: "listen", label: "Listen", short: "2", icon: Headphones },
  { id: "study", label: "Study", short: "3", icon: BookOpen },
  { id: "practice", label: "Practice", short: "4", icon: MessageCircle },
];

function deriveListeningTitle(audioName: string | null, transcript: string): string {
  if (audioName) {
    return audioName.replace(/\.[^.]+$/, "");
  }
  const firstLine = transcript.trim().split(/\n/)[0]?.trim();
  if (firstLine && firstLine.length <= 60) return firstLine;
  if (firstLine) return `${firstLine.slice(0, 57)}…`;
  return `Listening ${new Date().toLocaleDateString()}`;
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function StepNav() {
  const { listeningHubView, setListeningHubView } = useLesson();

  return (
    <nav
      aria-label="Listening workflow"
      className="grid grid-cols-4 gap-1.5 sm:gap-2"
    >
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = listeningHubView === step.id;
        const isPast =
          STEPS.findIndex((s) => s.id === listeningHubView) > index;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => setListeningHubView(step.id)}
            aria-current={isActive ? "step" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 transition sm:min-h-16 sm:gap-1 ${
              isActive
                ? "bg-[var(--accent)] text-white shadow-md"
                : isPast
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="hidden text-xs font-semibold sm:inline sm:text-sm">
              {step.label}
            </span>
            <span className="text-[10px] font-bold sm:hidden">{step.short}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ImportView() {
  const {
    addCustomListening,
    setListeningHubView,
    customListenings,
    removeCustomListening,
    selectedListeningId,
    setSelectedListeningId,
  } = useLesson();
  const [transcript, setTranscript] = useState("");
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setSaveError("Audio file must be under 15 MB.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAudioPreview(dataUrl);
      setAudioName(file.name);
    } catch {
      setSaveError("Failed to read audio file.");
    }
    event.target.value = "";
  };

  const handleSave = async () => {
    if (!transcript.trim()) {
      setSaveError("Add the listening text (transcript) before saving.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const title = deriveListeningTitle(audioName, transcript);

    try {
      await addCustomListening(title, transcript, audioPreview);
      setTranscript("");
      setAudioPreview(null);
      setAudioName(null);
      setListeningHubView("listen");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const previewTitle = deriveListeningTitle(audioName, transcript);

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-1 text-lg font-semibold sm:text-xl">
          Import a listening
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
          Upload audio (optional) and add the transcript. Name comes from your
          audio file or the first line of text.
        </p>

        <label className="mb-2 block text-sm font-medium">
          Audio recording (optional)
        </label>
        <label className="mb-3 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:w-auto">
          <Upload className="h-4 w-4" aria-hidden />
          Upload audio (.mp3, .wav, .m4a)
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            className="hidden"
            onChange={(e) => void handleAudioUpload(e)}
          />
        </label>
        {audioName && (
          <p className="mb-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <Headphones className="h-4 w-4 shrink-0" aria-hidden />
            {audioName}
          </p>
        )}

        <label className="mb-2 block text-sm font-medium">
          Listening text (transcript)
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={8}
          placeholder="Paste or type the full text of what is spoken…"
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base leading-relaxed"
        />

        <OcrImageImport
          onTextExtracted={(text) =>
            setTranscript((prev) => (prev ? `${prev}\n\n${text}` : text))
          }
          label="Scan text from photo"
          hint="Photograph a page — text fills the transcript above."
        />

        {transcript.trim() && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Will save as:{" "}
            <strong className="text-[var(--foreground)]">{previewTitle}</strong>
          </p>
        )}

        {saveError && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {saveError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!transcript.trim() || isSaving}
          className="mt-4 min-h-12 w-full rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:w-auto"
        >
          {isSaving ? "Saving…" : "Save listening"}
        </button>
      </Card>

      <SavedListeningsLibrary
        listenings={customListenings}
        selectedListeningId={selectedListeningId}
        onSelectListening={(id) => {
          setSelectedListeningId(id);
          setListeningHubView("listen");
        }}
        onRemoveListening={removeCustomListening}
      />
    </div>
  );
}

function ListenView() {
  const { selectedListening, setListeningHubView } = useLesson();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const autoTtsStartedRef = useRef(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else void audio.play();
  }, [isPlaying]);

  const speakTranscript = useCallback(() => {
    if (!selectedListening || typeof window === "undefined") return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectedListening.transcript);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.onstart = () => setTtsSpeaking(true);
    utterance.onend = () => setTtsSpeaking(false);
    utterance.onerror = () => setTtsSpeaking(false);

    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((v) => v.lang.startsWith("en") && v.localService) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
  }, [selectedListening]);

  const stopTts = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setTtsSpeaking(false);
  }, []);

  useEffect(() => {
    autoTtsStartedRef.current = false;
    return () => stopTts();
  }, [selectedListening?.id, stopTts]);

  useEffect(() => {
    if (!selectedListening || selectedListening.audioSrc) return;
    if (autoTtsStartedRef.current) return;

    autoTtsStartedRef.current = true;
    const timer = setTimeout(() => speakTranscript(), 600);
    return () => clearTimeout(timer);
  }, [selectedListening, speakTranscript]);

  if (!selectedListening) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          Import a listening first, then come back here to play it.
        </p>
      </Card>
    );
  }

  const hasAudio = Boolean(selectedListening.audioSrc);

  return (
    <div className="space-y-5">
      <Card className="text-center sm:p-8">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg sm:h-24 sm:w-24">
          <Headphones className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
        </div>
        <h2 className="mb-2 text-lg font-bold sm:text-2xl">
          {selectedListening.title}
        </h2>
        <p className="mb-6 text-sm text-[var(--muted)]">
          {hasAudio
            ? "Play the recording, then Study or Practice."
            : "No audio file — full speech is read aloud automatically."}
        </p>

        {hasAudio && selectedListening.audioSrc && (
          <>
            <audio
              ref={audioRef}
              src={selectedListening.audioSrc}
              preload="metadata"
              onTimeUpdate={() =>
                setProgress(audioRef.current?.currentTime ?? 0)
              }
              onLoadedMetadata={() =>
                setDuration(audioRef.current?.duration ?? 0)
              }
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />

            <button
              type="button"
              onClick={togglePlay}
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition hover:bg-[var(--accent-hover)] active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-10 w-10" aria-hidden />
              ) : (
                <Play className="h-10 w-10 translate-x-0.5" aria-hidden />
              )}
            </button>

            <div className="mx-auto mb-4 max-w-md px-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = t;
                    setProgress(t);
                  }
                }}
                className="w-full accent-[var(--accent)]"
                aria-label="Playback progress"
              />
              <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap justify-center gap-2">
              {[0.75, 1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (audioRef.current) audioRef.current.playbackRate = rate;
                  }}
                  className={`min-h-10 min-w-12 rounded-lg px-3 text-sm font-medium ${
                    playbackRate === rate
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)]"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {ttsSpeaking ? (
            <button
              type="button"
              onClick={stopTts}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 font-medium sm:flex-none"
            >
              <Pause className="h-4 w-4" aria-hidden />
              Stop speech
            </button>
          ) : (
            <button
              type="button"
              onClick={speakTranscript}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              {hasAudio ? "Read transcript aloud" : "Replay full speech"}
            </button>
          )}
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setListeningHubView("study")}
          className="min-h-12 rounded-xl border border-[var(--border)] px-5 py-3 font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Study the text →
        </button>
        <button
          type="button"
          onClick={() => setListeningHubView("practice")}
          className="min-h-12 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Practice with AI →
        </button>
      </div>
    </div>
  );
}

function StudyView() {
  const { selectedListening } = useLesson();
  const [fontSize, setFontSize] = useState<"base" | "lg" | "xl">("lg");
  const [showFullText, setShowFullText] = useState(true);

  const sizeClass = {
    base: "text-base leading-relaxed",
    lg: "text-lg leading-loose",
    xl: "text-xl leading-loose",
  }[fontSize];

  if (!selectedListening) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          Select or import a listening to read its text here.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            {selectedListening.title}
          </h2>
          <p className="text-sm text-[var(--muted)]">Study — read carefully</p>
        </div>
        <div className="flex gap-1.5">
          {(["base", "lg", "xl"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setFontSize(size)}
              className={`min-h-10 min-w-10 rounded-lg px-2 text-sm font-medium ${
                fontSize === size
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)]"
              }`}
            >
              {size === "base" ? "A" : size === "lg" ? "A+" : "A++"}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowFullText((v) => !v)}
        className="mb-3 min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold sm:w-auto"
      >
        {showFullText ? "Hide" : "Show"} full transcript
      </button>

      {showFullText && (
        <article
          className={`max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 sm:p-6 ${sizeClass}`}
        >
          {selectedListening.transcript.split(/\n\n+/).map((paragraph, i) => (
            <p key={i} className={i > 0 ? "mt-4" : ""}>
              {paragraph}
            </p>
          ))}
        </article>
      )}
    </Card>
  );
}

const PRACTICE_STATUS_LABELS = {
  idle: "Ready to practice",
  speaking: "AI Teacher is speaking…",
  listening: "Speak your answer — pauses are OK",
  processing: "Checking your answer…",
  error: "Something went wrong",
};

function PracticeView() {
  const { selectedListening, setListeningHubView } = useLesson();
  const {
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
  } = useListeningPractice(selectedListening);

  if (!selectedListening) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          Import and select a listening before practicing.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {!isSupported && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          Speech recognition is not supported. Use Chrome or Safari with a
          microphone.
        </div>
      )}

      <Card className="text-center sm:p-6">
        <div
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-white ${
            status === "listening"
              ? "animate-pulse bg-red-500"
              : status === "speaking"
                ? "bg-emerald-500"
                : status === "processing"
                  ? "bg-blue-500"
                  : "bg-zinc-500"
          }`}
        >
          {status === "processing" ? (
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          ) : status === "listening" ? (
            <Mic className="h-8 w-8" aria-hidden />
          ) : (
            <MessageCircle className="h-8 w-8" aria-hidden />
          )}
        </div>

        <p className="mb-4 text-base font-semibold sm:text-lg">
          {PRACTICE_STATUS_LABELS[status]}
        </p>

        {currentQuestion && practiceActive && (
          <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-left text-base leading-relaxed dark:bg-blue-950">
            {currentQuestion}
          </p>
        )}

        {(isAwaitingDone || liveTranscript) && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900 dark:bg-red-950 dark:text-red-100">
            {liveTranscript || "Speak now — the app detects when you finish."}
          </p>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={practiceActive ? stopPractice : startPractice}
            disabled={!isSupported}
            className={`min-h-14 w-full rounded-2xl py-4 text-lg font-bold text-white shadow-lg transition disabled:opacity-50 ${
              practiceActive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {practiceActive ? "Stop practice" : "Start AI Q&A"}
          </button>

          {isAwaitingDone && (
            <button
              type="button"
              onClick={finishResponding}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-white"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Done speaking
            </button>
          )}
        </div>
      </Card>

      {(lastAnswer || lastFeedback) && (
        <div className="space-y-3">
          {lastAnswer && (
            <Card>
              <p className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Your answer
              </p>
              <p className="leading-relaxed">{lastAnswer}</p>
            </Card>
          )}
          {lastFeedback && (
            <Card>
              <p className="mb-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                Teacher feedback
              </p>
              <p className="leading-relaxed">{lastFeedback}</p>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Conversation</h3>
            <button
              type="button"
              onClick={resetPractice}
              className="min-h-10 px-2 text-sm text-[var(--muted)]"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {history.map((msg) => (
              <li
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-emerald-100 dark:bg-emerald-950"
                    : "bg-blue-100 dark:bg-blue-950"
                }`}
              >
                <span className="text-xs font-semibold uppercase opacity-60">
                  {msg.role === "user" ? "You" : "Teacher"}
                </span>
                <p className="mt-0.5">{msg.content}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!practiceActive && (
        <button
          type="button"
          onClick={() => setListeningHubView("listen")}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] py-3 font-medium"
        >
          ← Listen again first
        </button>
      )}
    </div>
  );
}

export function ListeningHub() {
  const {
    listeningHubView,
    customListenings,
    selectedListeningId,
    setSelectedListeningId,
    removeCustomListening,
  } = useLesson();

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <h2 className="mb-1 text-lg font-bold sm:text-xl">Listening Hub</h2>
        <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
          Import → Listen → Study → Practice
        </p>
        <StepNav />
      </Card>

      {listeningHubView !== "import" && customListenings.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedListeningId ?? ""}
            onChange={(e) => setSelectedListeningId(e.target.value || null)}
            className="min-h-12 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base"
            aria-label="Active listening"
          >
            {customListenings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          {selectedListeningId && (
            <button
              type="button"
              onClick={() => void removeCustomListening(selectedListeningId)}
              aria-label="Delete selected listening"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {listeningHubView === "import" && <ImportView />}
      {listeningHubView === "listen" && <ListenView />}
      {listeningHubView === "study" && <StudyView />}
      {listeningHubView === "practice" && <PracticeView />}
    </div>
  );
}

export function ListeningHubSidePanel() {
  const { listeningHubView, selectedListening } = useLesson();

  const tips: Record<ListeningHubView, string[]> = {
    import: [
      "Upload audio or paste transcript text.",
      "Name is taken from the file or first line.",
      "Without audio, full speech is generated automatically.",
    ],
    listen: [
      "Use headphones for clearer listening.",
      "Slow down playback (0.75x) if needed.",
      "Text-only listenings auto-read the full transcript.",
    ],
    study: [
      "Read the full text without audio first.",
      "Increase font size for comfortable reading.",
      "Look up unknown words with Translate.",
    ],
    practice: [
      "AI asks questions about what you heard.",
      "Wrong answers get honest corrections.",
      "Use Drive mode tab for hands-free practice.",
    ],
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 text-base font-semibold sm:text-lg">
        {listeningHubView.charAt(0).toUpperCase() + listeningHubView.slice(1)}{" "}
        tips
      </h2>
      {selectedListening && (
        <p className="mb-3 truncate text-sm font-medium text-[var(--accent)]">
          {selectedListening.title}
        </p>
      )}
      <ul className="space-y-2 text-sm leading-relaxed text-[var(--muted)]">
        {tips[listeningHubView].map((tip, i) => (
          <li key={i}>• {tip}</li>
        ))}
      </ul>
    </section>
  );
}
