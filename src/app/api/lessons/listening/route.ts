import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/auth-utils";
import type { LessonListening } from "@/types/lesson";

function toLessonListening(doc: {
  id: string;
  title: string;
  transcript: string;
  audioBase64: string | null;
  createdAt: Date;
}): LessonListening {
  return {
    id: doc.id,
    title: doc.title,
    transcript: doc.transcript,
    audioSrc: doc.audioBase64,
    createdAt: doc.createdAt.getTime(),
  };
}

export async function GET() {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const docs = await prisma.customListening.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    listenings: docs.map((doc) => toLessonListening(doc)),
  });
}

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const body = (await request.json()) as {
    title?: string;
    transcript?: string;
    audioBase64?: string | null;
  };

  const title = body.title?.trim() || "Untitled listening";
  const transcript = body.transcript?.trim() ?? "";

  if (!transcript) {
    return NextResponse.json(
      { error: "Listening transcript text is required." },
      { status: 400 },
    );
  }

  const doc = await prisma.customListening.create({
    data: {
      userId,
      title,
      transcript,
      audioBase64: body.audioBase64 ?? null,
    },
  });

  return NextResponse.json(
    { listening: toLessonListening(doc) },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Valid listening id is required." },
      { status: 400 },
    );
  }

  const result = await prisma.customListening.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Listening not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
