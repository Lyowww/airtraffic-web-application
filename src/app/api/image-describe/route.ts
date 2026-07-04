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
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You describe images in clear, simple English for an older language learner practicing speaking. Write 2–4 complete sentences covering: the main subject(s), what they are doing, colors, location or setting, and any important details someone should mention when describing the photo aloud. Use natural conversational English — not bullet points, not markdown, not lists. Be accurate and thorough so the learner knows the full correct answer.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in simple English for a flashcard. Return only the description.",
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
      console.error("Image describe OpenRouter error:", errorText);
      return NextResponse.json(
        { error: "Failed to describe image. Please try again." },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const description = content.trim();

    if (!description) {
      return NextResponse.json(
        { error: "Could not describe this image." },
        { status: 422 },
      );
    }

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Image describe route error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
