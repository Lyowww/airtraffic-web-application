"use client";

import { useState, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { TranslatePanel } from "@/components/TranslatePanel";

interface DashboardLayoutProps {
  children: ReactNode;
  sidePanel?: ReactNode;
  header?: ReactNode;
}

export function DashboardLayout({
  children,
  sidePanel,
  header,
}: DashboardLayoutProps) {
  const [translateOpen, setTranslateOpen] = useState(false);

  const toggleTranslate = () => setTranslateOpen((prev) => !prev);
  const closeTranslate = () => setTranslateOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] xl:grid xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(280px,360px)]">
      {/* Desktop sidebar navigation */}
      <aside className="hidden border-r border-[var(--border)] bg-[var(--card)] xl:flex xl:flex-col">
        <Navigation variant="sidebar" />
      </aside>

      {/* Main content column */}
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] xl:pb-0">
        {header && (
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 py-4 backdrop-blur-md sm:px-6 xl:px-8">
            {header}
          </header>
        )}

        <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          {/* Tablet 2-column split */}
          <div className="mx-auto max-w-7xl md:grid md:grid-cols-2 md:items-start md:gap-6 lg:gap-8 xl:grid-cols-1 xl:max-w-none">
            <div className="min-w-0">{children}</div>

            {sidePanel && (
              <aside
                className="mt-6 min-w-0 md:mt-0 xl:hidden"
                aria-label="Feedback and metrics"
              >
                {sidePanel}
              </aside>
            )}
          </div>

          {/* Desktop: side panel below main on xl when needed for drive feedback */}
          {sidePanel && (
            <aside
              className="mx-auto mt-8 hidden max-w-3xl xl:block"
              aria-label="Feedback and metrics"
            >
              {sidePanel}
            </aside>
          )}
        </div>

        {/* Tablet translate toggle (floating) */}
        <button
          type="button"
          onClick={toggleTranslate}
          aria-expanded={translateOpen}
          aria-label="Toggle Google Translate"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition hover:bg-[var(--accent-hover)] active:scale-95 md:bottom-6 xl:hidden"
        >
          <Languages className="h-6 w-6" aria-hidden />
        </button>
      </div>

      {/* Desktop translate sidebar */}
      <div className="hidden xl:flex xl:flex-col">
        <TranslatePanel
          variant="sidebar"
          isOpen
          onClose={() => undefined}
        />
      </div>

      {/* Mobile / tablet translate drawer */}
      <TranslatePanel
        variant="drawer"
        isOpen={translateOpen}
        onClose={closeTranslate}
      />

      {/* Mobile bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 xl:hidden">
        <Navigation
          variant="bottom"
          onTranslateToggle={toggleTranslate}
          translateOpen={translateOpen}
        />
      </div>
    </div>
  );
}
