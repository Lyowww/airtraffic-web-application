export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });

  const data = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to extract text from image.");
  }

  if (!data.text?.trim()) {
    throw new Error("No readable text was found in the image.");
  }

  return data.text.trim();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
