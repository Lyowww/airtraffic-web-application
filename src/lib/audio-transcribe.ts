import { transcribeAudioInBrowser } from "@/lib/client-whisper";

export async function transcribeAudioFromDataUrl(
  audioDataUrl: string,
  _fileName?: string | null,
  onProgress?: (message: string) => void,
): Promise<string> {
  return transcribeAudioInBrowser(audioDataUrl, onProgress);
}
