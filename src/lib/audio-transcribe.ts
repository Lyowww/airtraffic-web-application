const MIME_TO_FORMAT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

const EXT_TO_FORMAT: Record<string, string> = {
  mp3: "mp3",
  wav: "wav",
  m4a: "m4a",
  webm: "webm",
  ogg: "ogg",
  flac: "flac",
  aac: "aac",
};

export function parseAudioDataUrl(
  dataUrl: string,
  fileName?: string | null,
): { base64: string; format: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error("Invalid audio data.");
  }

  const mime = match[1].toLowerCase();
  let format = MIME_TO_FORMAT[mime];

  if (!format && fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext) format = EXT_TO_FORMAT[ext];
  }

  return {
    base64: match[2],
    format: format ?? "mp3",
  };
}

export async function transcribeAudioFromDataUrl(
  audioDataUrl: string,
  fileName?: string | null,
): Promise<string> {
  const { base64, format } = parseAudioDataUrl(audioDataUrl, fileName);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64: base64, format }),
  });

  const data = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to transcribe audio.");
  }

  if (!data.text?.trim()) {
    throw new Error("No speech was detected in the audio.");
  }

  return data.text.trim();
}
