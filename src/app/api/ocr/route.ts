import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth-utils";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "openrouter/free";
const FALLBACK_MODEL = "google/gemma-4-31b-it:free";

function getOpenRouterApiKey(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("sk-or-")) {
    return null;
  }
  return apiKey;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  imageBase64: string,
): Promise<Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
      "X-Title": "Aghas English Practice",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content:
            "You extract English text from images. Return ONLY the extracted text, preserving paragraphs and punctuation. Do not add commentary, labels, or markdown. If no readable text is found, return an empty string.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all English text from this image. Return only the text content.",
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
    }),
  });
}

export async function POST(request: Request) {
  try {
    const authResult = await requireSessionUserId();
    if (authResult.error) return authResult.error;

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key is missing. Add OPENROUTER_API_KEY to your environment.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { imageBase64?: string };
    if (!body.imageBase64?.trim()) {
      return NextResponse.json(
        { error: "Image data is required." },
        { status: 400 },
      );
    }

    let response = await callOpenRouter(apiKey, PRIMARY_MODEL, body.imageBase64);

    if (!response.ok) {
      response = await callOpenRouter(apiKey, FALLBACK_MODEL, body.imageBase64);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OCR OpenRouter error:", errorText);
      return NextResponse.json(
        { error: "Failed to extract text from image. Please try again." },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const text = content.trim();

    if (!text) {
      return NextResponse.json(
        { error: "No readable text was found in the image." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("OCR route error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
