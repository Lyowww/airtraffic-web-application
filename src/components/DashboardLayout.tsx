"use client";

import { useState, type ReactNode } from "react";
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
    <div className="flex min-h-screen flex-col bg-[var(--background)] lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(280px,360px)]">
      {/* Desktop sidebar navigation */}
      <aside className="hidden border-r border-[var(--border)] bg-[var(--card)] lg:flex lg:flex-col">
        <Navigation variant="sidebar" />
      </aside>

      {/* Main content column */}
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {header && (
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 xl:px-8">
            {header}
          </header>
        )}

        <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          {/* Tablet: side-by-side on md+, stacked on phone */}
          <div className="mx-auto max-w-7xl md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-start md:gap-5 lg:gap-6 xl:grid-cols-1 xl:max-w-none">
            <main className="min-w-0">{children}</main>

            {sidePanel && (
              <aside
                className="mt-5 min-w-0 md:mt-0 xl:hidden"
                aria-label="Feedback and tips"
              >
                {sidePanel}
              </aside>
            )}
          </div>

          {sidePanel && (
            <aside
              className="mx-auto mt-6 hidden max-w-3xl xl:block"
              aria-label="Feedback and tips"
            >
              {sidePanel}
            </aside>
          )}
        </div>
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
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <Navigation
          variant="bottom"
          onTranslateToggle={toggleTranslate}
          translateOpen={translateOpen}
        />
      </div>
    </div>
  );
}
