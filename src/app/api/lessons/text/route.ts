import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { requireSessionUserId } from "@/lib/auth-utils";
import { CustomText } from "@/models/LessonData";
import type { LessonText } from "@/types/lesson";

function toLessonText(doc: {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
}): LessonText {
  return {
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    createdAt: doc.createdAt.getTime(),
  };
}

export async function GET() {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;
  const { userId } = authResult;

  await connectMongoDB();

  const docs = await CustomText.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    texts: docs.map((doc) =>
      toLessonText({
        _id: doc._id,
        title: doc.title,
        content: doc.content,
        createdAt: doc.createdAt,
      }),
    ),
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

  await connectMongoDB();

  const doc = await CustomText.create({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    content,
  });

  return NextResponse.json(
    {
      text: toLessonText({
        _id: doc._id,
        title: doc.title,
        content: doc.content,
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
    return NextResponse.json({ error: "Valid text id is required." }, { status: 400 });
  }

  await connectMongoDB();

  const result = await CustomText.deleteOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Text not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
