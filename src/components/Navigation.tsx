"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  Car,
  FileText,
  Headphones,
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
    id: "listening-hub",
    label: "Listening Hub",
    shortLabel: "Listen",
    icon: <Headphones className="h-[22px] w-[22px] shrink-0" aria-hidden />,
  },
  {
    id: "drive",
    label: "Drive Mode",
    shortLabel: "Drive",
    icon: <Car className="h-[22px] w-[22px] shrink-0" aria-hidden />,
  },
  {
    id: "text-import",
    label: "Text Config",
    shortLabel: "Text",
    icon: <FileText className="h-[22px] w-[22px] shrink-0" aria-hidden />,
  },
  {
    id: "image-trainer",
    label: "Image Studio",
    shortLabel: "Images",
    icon: <BookOpen className="h-[22px] w-[22px] shrink-0" aria-hidden />,
  },
];

interface NavigationProps {
  variant: "sidebar" | "bottom";
}

export function Navigation({ variant }: NavigationProps) {
  const { activeTab, setActiveTab } = useLesson();
  const { theme, toggleTheme } = useTheme();

  if (variant === "sidebar") {
    return (
      <nav
        className="flex h-full w-full flex-col"
        aria-label="Main navigation"
      >
        <div className="border-b border-[var(--border)] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-md">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                Aghas English
              </p>
              <h1 className="text-base font-bold tracking-tight">
                Practice Hub
              </h1>
            </div>
          </div>
        </div>

        <ul className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-[3rem] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--accent)] text-white shadow-md"
                      : "text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1 border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className="flex min-h-[3rem] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--accent-soft)]"
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
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="flex min-h-[3rem] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/50"
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
      className="nav-glass safe-bottom flex w-full items-stretch justify-around border-t border-[var(--border)] px-2 py-2 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.3)]"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex min-h-[3.25rem] min-w-0 flex-1 max-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all active:scale-95 ${
              isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {isActive && (
              <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                isActive
                  ? "bg-[var(--accent)] text-white shadow-md"
                  : "bg-transparent"
              }`}
            >
              {item.icon}
            </span>
            <span className="max-w-full truncate text-[11px] font-semibold leading-none">
              {item.shortLabel}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
