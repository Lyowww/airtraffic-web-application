import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { requireSessionUserId } from "@/lib/auth-utils";
import { CustomImage } from "@/models/LessonData";
import type { LessonImage } from "@/types/lesson";

function toLessonImage(doc: {
  _id: mongoose.Types.ObjectId;
  title: string;
  imageBufferOrBase64: string;
  correctExplanation: string;
  createdAt: Date;
}): LessonImage {
  return {
    id: doc._id.toString(),
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

  await connectMongoDB();

  const docs = await CustomImage.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    images: docs.map((doc) =>
      toLessonImage({
        _id: doc._id,
        title: doc.title,
        imageBufferOrBase64: doc.imageBufferOrBase64,
        correctExplanation: doc.correctExplanation,
        createdAt: doc.createdAt,
      }),
    ),
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

  await connectMongoDB();

  const doc = await CustomImage.create({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    imageBufferOrBase64,
    correctExplanation,
  });

  return NextResponse.json(
    {
      image: toLessonImage({
        _id: doc._id,
        title: doc.title,
        imageBufferOrBase64: doc.imageBufferOrBase64,
        correctExplanation: doc.correctExplanation,
        createdAt: doc.createdAt,
      }),
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Valid image id is required." }, { status: 400 });
  }

  await connectMongoDB();

  const result = await CustomImage.deleteOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
