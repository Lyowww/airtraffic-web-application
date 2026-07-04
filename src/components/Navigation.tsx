"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  Car,
  FileText,
  Languages,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useLesson } from "@/context/LessonContext";
import { useTheme } from "@/context/ThemeContext";
import type { AppTab } from "@/types/lesson";

interface NavItem {
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "drive",
    label: "Drive / Listening",
    shortLabel: "Drive",
    icon: <Car className="h-5 w-5 shrink-0" aria-hidden />,
  },
  {
    id: "text-import",
    label: "Text Config",
    shortLabel: "Text",
    icon: <FileText className="h-5 w-5 shrink-0" aria-hidden />,
  },
  {
    id: "image-trainer",
    label: "Image Studio",
    shortLabel: "Images",
    icon: <BookOpen className="h-5 w-5 shrink-0" aria-hidden />,
  },
];

interface NavigationProps {
  variant: "sidebar" | "bottom";
  onTranslateToggle?: () => void;
  translateOpen?: boolean;
}

export function Navigation({
  variant,
  onTranslateToggle,
  translateOpen,
}: NavigationProps) {
  const { activeTab, setActiveTab } = useLesson();
  const { theme, toggleTheme } = useTheme();

  if (variant === "sidebar") {
    return (
      <nav
        className="flex h-full w-full flex-col"
        aria-label="Main navigation"
      >
        <div className="border-b border-[var(--border)] px-5 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Aghas English
          </p>
          <h1 className="mt-1 text-lg font-bold tracking-tight">
            Practice Hub
          </h1>
        </div>

        <ul className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === item.id
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" aria-hidden />
            ) : (
              <Sun className="h-5 w-5" aria-hidden />
            )}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sign out
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="safe-bottom flex w-full items-stretch justify-around border-t border-[var(--border)] bg-[var(--card)] px-2 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setActiveTab(item.id)}
          aria-current={activeTab === item.id ? "page" : undefined}
          className={`flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
            activeTab === item.id
              ? "text-[var(--accent)]"
              : "text-[var(--muted)]"
          }`}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
              activeTab === item.id
                ? "bg-[var(--accent)] text-white"
                : "bg-transparent"
            }`}
          >
            {item.icon}
          </span>
          <span className="truncate">{item.shortLabel}</span>
        </button>
      ))}

      {onTranslateToggle && (
        <button
          type="button"
          onClick={onTranslateToggle}
          aria-expanded={translateOpen}
          aria-label="Toggle Google Translate"
          className={`flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
            translateOpen ? "text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
              translateOpen
                ? "bg-[var(--accent)] text-white"
                : "bg-transparent"
            }`}
          >
            <Languages className="h-5 w-5" aria-hidden />
          </span>
          <span className="truncate">Translate</span>
        </button>
      )}

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold text-[var(--muted)] transition"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full">
          {theme === "light" ? (
            <Moon className="h-5 w-5" aria-hidden />
          ) : (
            <Sun className="h-5 w-5" aria-hidden />
          )}
        </span>
        <span className="truncate">Theme</span>
      </button>
    </nav>
  );
}
