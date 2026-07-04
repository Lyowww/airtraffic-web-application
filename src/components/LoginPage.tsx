"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Moon,
  Sun,
  UserPlus,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

type AuthMode = "login" | "signup";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const registerData = (await registerRes.json()) as { error?: string };
        if (!registerRes.ok) {
          setError(registerData.error ?? "Unable to create account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(
          mode === "signup"
            ? "Account created, but sign-in failed. Please try logging in."
            : "Invalid email or password.",
        );
        return;
      }

      if (callbackUrl !== "/") {
        router.push(result?.url ?? callbackUrl);
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:right-6 sm:top-6"
      >
        {theme === "light" ? (
          <Moon className="h-5 w-5" aria-hidden />
        ) : (
          <Sun className="h-5 w-5" aria-hidden />
        )}
      </button>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg">
            <BookOpen className="h-7 w-7" aria-hidden />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Aghas English
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Sign in to save custom readings and image flashcards across devices.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[var(--background)] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`min-h-11 rounded-lg text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`min-h-11 rounded-lg text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === "signup"}
                  placeholder="Aghas jan"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base outline-none ring-[var(--accent)] focus:ring-2"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base outline-none ring-[var(--accent)] focus:ring-2"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  placeholder={
                    mode === "signup" ? "At least 8 characters" : "Your password"
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 pr-12 text-base outline-none ring-[var(--accent)] focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : mode === "login" ? (
                <LogIn className="h-5 w-5" aria-hidden />
              ) : (
                <UserPlus className="h-5 w-5" aria-hidden />
              )}
              {isSubmitting
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
