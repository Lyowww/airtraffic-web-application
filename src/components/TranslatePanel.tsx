"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ExternalLink,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  X,
} from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";

const GOOGLE_TRANSLATE_URL =
  "https://translate.google.com/?sl=en&tl=hy&op=translate";

interface TranslatePanelProps {
  variant: "drawer" | "sidebar";
  isOpen: boolean;
  onClose: () => void;
}

export function TranslatePanel({
  variant,
  isOpen,
  onClose,
}: TranslatePanelProps) {
  const [input, setInput] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  const {
    isListening,
    isSupported: isVoiceSupported,
    error: voiceError,
    listen,
    stopListening,
    clearError: clearVoiceError,
  } = useSpeech({ lang: "en-US" });

  const translateText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTranslation("");
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = (await response.json()) as {
        translation?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Translation failed");
        setTranslation("");
        return;
      }

      setTranslation(data.translation ?? "");
    } catch {
      setError("Translation failed. Check your connection and try again.");
      setTranslation("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTranslate = useCallback(async () => {
    await translateText(input);
  }, [input, translateText]);

  const handleSpeak = useCallback((text: string, lang: string) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleVoiceInput = useCallback(() => {
    clearVoiceError();
    setError(null);

    if (isListening) {
      stopListening();
      return;
    }

    listen({
      continuous: true,
      interimResults: true,
      onResult: (transcript) => {
        setInput(transcript);
      },
      onEnd: () => {
        const finalText = inputRef.current.trim();
        if (finalText) {
          void translateText(finalText);
        }
      },
      onError: (speechError) => {
        if (speechError === "mic-denied") {
          setError("Microphone access denied. Allow mic access to speak.");
        } else if (speechError === "not-supported") {
          setError("Voice input is not supported in this browser.");
        } else if (speechError !== "no-speech" && speechError !== "aborted") {
          setError("Voice input failed. Please try again.");
        }
      },
    });
  }, [
    clearVoiceError,
    isListening,
    listen,
    stopListening,
    translateText,
  ]);

  useEffect(() => {
    if (!isOpen && variant === "drawer") {
      stopListening();
    }
  }, [isOpen, stopListening, variant]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleTranslate();
    }
  };

  const panelContent = (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-[var(--accent)]" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Translator</h2>
            <p className="text-xs text-[var(--muted)]">English → Armenian</p>
          </div>
        </div>
        {variant === "drawer" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close translate panel"
            className="flex h-12 w-12 items-center justify-center rounded-xl transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <label className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--muted)]">
              English
            </span>
            {isVoiceSupported && (
              <button
                type="button"
                onClick={handleVoiceInput}
                aria-label={isListening ? "Stop voice input" : "Speak in English"}
                aria-pressed={isListening}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
                  isListening
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
                    : "text-[var(--muted)] hover:bg-zinc-100 hover:text-[var(--accent)] dark:hover:bg-zinc-800"
                }`}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden />
                )}
                {isListening ? "Stop" : "Voice"}
              </button>
            )}
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isVoiceSupported
                ? "Type or tap Voice to speak…"
                : "Type a word or phrase…"
            }
            className="min-h-28 w-full flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-relaxed outline-none ring-[var(--accent)] focus:ring-2"
          />
          {isListening && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Listening… speak in English, then tap Stop.
            </p>
          )}
        </label>

        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={isLoading || !input.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
          )}
          {isLoading ? "Translating…" : "Translate"}
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--muted)]">
              Armenian
            </span>
            {translation && (
              <button
                type="button"
                onClick={() => handleSpeak(translation, "hy-AM")}
                aria-label="Listen to Armenian translation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-zinc-100 hover:text-[var(--accent)] dark:hover:bg-zinc-800"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div
            className="min-h-28 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-relaxed"
            aria-live="polite"
          >
            {error ? (
              <p className="text-red-600 dark:text-red-400">{error}</p>
            ) : voiceError === "mic-denied" ? (
              <p className="text-red-600 dark:text-red-400">
                Microphone access denied.
              </p>
            ) : translation ? (
              <p>{translation}</p>
            ) : (
              <p className="text-[var(--muted)]">
                Translation will appear here.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--border)] px-4 py-2">
        <a
          href={GOOGLE_TRANSLATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-medium text-[var(--accent)] transition hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full Google Translate
        </a>
      </footer>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <aside
        className="flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--card)]"
        aria-label="Translator companion"
      >
        {panelContent}
      </aside>
    );
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close translate drawer"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Translator companion"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl transition-transform duration-300 ease-out xl:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {panelContent}
      </aside>
    </>
  );
}
