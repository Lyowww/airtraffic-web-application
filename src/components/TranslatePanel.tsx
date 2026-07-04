"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Languages, X } from "lucide-react";

const TRANSLATE_URL =
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
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const handleIframeError = useCallback(() => {
    setIframeBlocked(true);
  }, []);

  const panelContent = (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-[var(--accent)]" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Google Translate</h2>
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

      <div className="relative min-h-0 flex-1 bg-white dark:bg-zinc-900">
        {iframeBlocked ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Languages className="h-12 w-12 text-[var(--muted)]" aria-hidden />
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Google Translate cannot be embedded here. Open it in a new tab to
              type phrases, read translations, and use audio playback.
            </p>
            <a
              href={TRANSLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              <ExternalLink className="h-4 w-4" />
              Open Google Translate
            </a>
          </div>
        ) : (
          <iframe
            src={TRANSLATE_URL}
            title="Google Translate — English to Armenian"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer-when-downgrade"
            onError={handleIframeError}
            loading="lazy"
          />
        )}
      </div>

      <footer className="shrink-0 border-t border-[var(--border)] px-4 py-2">
        <a
          href={TRANSLATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-medium text-[var(--accent)] transition hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </footer>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <aside
        className="flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--card)]"
        aria-label="Google Translate companion"
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
        aria-label="Google Translate companion"
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
