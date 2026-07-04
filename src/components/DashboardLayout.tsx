"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { TranslatePanel } from "@/components/TranslatePanel";

interface DashboardLayoutProps {
  children: ReactNode;
  sidePanel?: ReactNode;
  sidePanelTitle?: string;
  header?: ReactNode;
}

function CollapsibleSidePanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="app-card overflow-hidden md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold transition active:bg-[var(--accent-soft)]"
      >
        <span className="text-sm">{title}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="animate-fade-in-up border-t border-[var(--border)] px-4 pb-4 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function DashboardLayout({
  children,
  sidePanel,
  sidePanelTitle = "Tips & feedback",
  header,
}: DashboardLayoutProps) {
  const [translateOpen, setTranslateOpen] = useState(false);

  const toggleTranslate = () => setTranslateOpen((prev) => !prev);
  const closeTranslate = () => setTranslateOpen(false);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--background)] md:grid md:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(280px,360px)]">
      {/* Sidebar — tablet (md) and desktop */}
      <aside className="hidden border-r border-[var(--border)] bg-[var(--card)] md:flex md:flex-col">
        <Navigation variant="sidebar" />
      </aside>

      {/* Main content column */}
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(var(--nav-height)+env(safe-area-inset-bottom))] md:pb-0">
        {header && (
          <header className="safe-top sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-3.5 xl:px-8">
            {header}
          </header>
        )}

        <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5 xl:px-8 xl:py-8">
          <div className="mx-auto max-w-3xl space-y-4 md:max-w-none md:space-y-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] md:items-start md:gap-5 lg:gap-6 xl:grid-cols-1">
            <main className="min-w-0 animate-fade-in-up">{children}</main>

            {/* Tablet: side panel inline */}
            {sidePanel && (
              <aside
                className="hidden min-w-0 md:block xl:hidden"
                aria-label="Feedback and tips"
              >
                <div className="app-card-elevated p-4 sm:p-5">{sidePanel}</div>
              </aside>
            )}
          </div>

          {/* Mobile: collapsible side panel below main content */}
          {sidePanel && (
            <aside
              className="mx-auto mt-4 max-w-3xl md:hidden"
              aria-label="Feedback and tips"
            >
              <CollapsibleSidePanel title={sidePanelTitle}>
                {sidePanel}
              </CollapsibleSidePanel>
            </aside>
          )}

          {/* Desktop xl: side panel below main (3-col layout uses translate sidebar) */}
          {sidePanel && (
            <aside
              className="mx-auto mt-6 hidden max-w-3xl xl:block"
              aria-label="Feedback and tips"
            >
              <div className="app-card-elevated p-4 sm:p-5">{sidePanel}</div>
            </aside>
          )}
        </div>
      </div>

      {/* Desktop translate sidebar */}
      <div className="hidden xl:flex xl:flex-col">
        <TranslatePanel variant="sidebar" isOpen onClose={() => undefined} />
      </div>

      {/* Mobile / tablet translate drawer */}
      <TranslatePanel
        variant="drawer"
        isOpen={translateOpen}
        onClose={closeTranslate}
      />

      {/* Mobile bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
        <Navigation variant="bottom" />
      </div>

      {/* Floating translate button — mobile & tablet */}
      <button
        type="button"
        onClick={toggleTranslate}
        aria-expanded={translateOpen}
        aria-label="Open translator"
        className={`fixed z-40 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-all active:scale-95 md:bottom-6 md:right-6 bottom-[calc(var(--nav-height)+0.75rem+env(safe-area-inset-bottom))] right-4 ${
          translateOpen
            ? "bg-zinc-600 shadow-xl"
            : "bg-[var(--accent)] shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:bg-[var(--accent-hover)]"
        }`}
      >
        <Languages className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}
