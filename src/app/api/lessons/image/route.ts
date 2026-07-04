import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/auth-utils";
import type { LessonImage } from "@/types/lesson";

function toLessonImage(doc: {
  id: string;
  title: string;
  imageBufferOrBase64: string;
  correctExplanation: string;
  createdAt: Date;
}): LessonImage {
  return {
    id: doc.id,
    title: doc.title,
    imageSrc: doc.imageBufferOrBase64,
    standardExplanation: doc.correctExplanation,
    createdAt: doc.createdAt.getTime(),
  };
}

export async function GET() {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const docs = await prisma.customImage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    images: docs.map((doc) => toLessonImage(doc)),
  });
}

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const body = (await request.json()) as {
    title?: string;
    imageBufferOrBase64?: string;
    correctExplanation?: string;
  };

  const title = body.title?.trim() || "Flashcard image";
  const imageBufferOrBase64 = body.imageBufferOrBase64?.trim() ?? "";
  const correctExplanation = body.correctExplanation?.trim() ?? "";

  if (!imageBufferOrBase64 || !correctExplanation) {
    return NextResponse.json(
      { error: "Image data and correct explanation are required." },
      { status: 400 },
    );
  }

  const doc = await prisma.customImage.create({
    data: {
      userId,
      title,
      imageBufferOrBase64,
      correctExplanation,
    },
  });

  return NextResponse.json({ image: toLessonImage(doc) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Valid image id is required." }, { status: 400 });
  }

  const result = await prisma.customImage.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
