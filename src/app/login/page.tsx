import { Suspense } from "react";
import LoginPage from "./LoginPageClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
