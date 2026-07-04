import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/auth-utils";
import type { LessonText } from "@/types/lesson";

function toLessonText(doc: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}): LessonText {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    createdAt: doc.createdAt.getTime(),
  };
}

export async function GET() {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const docs = await prisma.customText.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    texts: docs.map((doc) => toLessonText(doc)),
  });
}

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const body = (await request.json()) as { title?: string; content?: string };
  const title = body.title?.trim() || "Untitled reading";
  const content = body.content?.trim() ?? "";

  if (!content) {
    return NextResponse.json(
      { error: "Reading text content is required." },
      { status: 400 },
    );
  }

  const doc = await prisma.customText.create({
    data: {
      userId,
      title,
      content,
    },
  });

  return NextResponse.json({ text: toLessonText(doc) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Valid text id is required." }, { status: 400 });
  }

  const result = await prisma.customText.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Text not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
