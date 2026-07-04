/**
 * Browser smoke test for client-side Whisper transcription.
 * Run: node scripts/test-whisper.mjs
 */
import { chromium } from "playwright";

function createSilentWavDataUrl(durationSec = 0.5) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

function buildHtml(dataUrl) {
  return `<!DOCTYPE html>
<html><body><script type="module">
const TRANSFORMERS_ESM = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm";
const ORT_WASM_PATH = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/";
const dataUrl = ${JSON.stringify(dataUrl)};

async function decodeToMono16k(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const decodeContext = new AudioContext();
  const decoded = await decodeContext.decodeAudioData(buffer.slice(0));
  await decodeContext.close();
  const targetRate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * targetRate)), targetRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

try {
  const { pipeline, env } = await import(TRANSFORMERS_ESM);
  env.allowLocalModels = false;
  env.useBrowserCache = typeof caches !== "undefined";
  env.backends.onnx.wasm.wasmPaths = ORT_WASM_PATH;
  env.backends.onnx.wasm.numThreads = 1;
  const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
  const audio = await decodeToMono16k(dataUrl);
  const result = await transcriber(audio, { sampling_rate: 16000, chunk_length_s: 30, stride_length_s: 5 });
  window.__RESULT__ = { ok: true, text: result?.text ?? "" };
} catch (e) {
  window.__RESULT__ = { ok: false, error: e?.message ?? String(e) };
}
</script></body></html>`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("browser:", msg.text()));
  page.on("pageerror", (err) => console.log("pageerror:", err.message));

  const dataUrl = createSilentWavDataUrl(0.5);
  await page.setContent(buildHtml(dataUrl), { waitUntil: "networkidle" });

  await page.waitForFunction(() => window.__RESULT__ !== undefined, undefined, {
    timeout: 180000,
  });

  const result = await page.evaluate(() => window.__RESULT__);
  await browser.close();

  if (!result.ok) {
    console.error("FAIL:", result.error);
    process.exit(1);
  }

  console.log("PASS: Whisper pipeline loaded and ran.");
  console.log("Text:", JSON.stringify(result.text));
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
