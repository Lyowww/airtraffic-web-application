import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth-utils";

const TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single";

type TranslateResponse = [Array<[string, string, ...unknown[]]>, ...unknown[]];

export async function POST(request: Request) {
  const authResult = await requireSessionUserId();
  if (authResult.error) return authResult.error;

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Text must be 2000 characters or fewer" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: "hy",
    dt: "t",
    q: text,
  });

  try {
    const response = await fetch(`${TRANSLATE_ENDPOINT}?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Translation service unavailable" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as TranslateResponse;
    const translation = data[0]?.map((segment) => segment[0]).join("") ?? "";

    if (!translation) {
      return NextResponse.json(
        { error: "Could not translate text" },
        { status: 502 },
      );
    }

    return NextResponse.json({ translation });
  } catch {
    return NextResponse.json(
      { error: "Translation service unavailable" },
      { status: 502 },
    );
  }
}
