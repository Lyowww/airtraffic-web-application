export async function describeImage(imageBase64: string): Promise<string> {
  const response = await fetch("/api/image-describe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });

  const data = (await response.json()) as {
    description?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to generate image description.");
  }

  if (!data.description?.trim()) {
    throw new Error("Could not describe this image. Try a clearer photo.");
  }

  return data.description.trim();
}
