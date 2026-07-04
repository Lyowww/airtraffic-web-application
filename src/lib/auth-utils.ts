import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

type AuthResult =
  | { session: Session; userId: string; error: null }
  | { session: null; userId: null; error: NextResponse };

export async function requireSessionUserId(): Promise<AuthResult> {
  const session = (await auth()) as Session | null;

  if (!session?.user?.id) {
    return {
      session: null,
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session, userId: session.user.id, error: null };
}
