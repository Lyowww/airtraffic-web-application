export async function transcribeAudioFromDataUrl(
  audioDataUrl: string,
  _fileName?: string | null,
  onProgress?: (message: string) => void,
): Promise<string> {
  const { transcribeAudioInBrowser } = await import("@/lib/client-whisper");
  return transcribeAudioInBrowser(audioDataUrl, onProgress);
}
