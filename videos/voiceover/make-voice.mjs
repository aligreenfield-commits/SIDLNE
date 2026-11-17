// Makes the how-to video's narration with Kokoro (open-weight TTS, Apache-2.0).
// Runs in GitHub Actions (see .github/workflows/voiceover.yml): one WAV per line.
import { KokoroTTS } from "kokoro-js";
import { readFileSync, mkdirSync } from "node:fs";

const script = JSON.parse(readFileSync(new URL("./script.json", import.meta.url)));
const out = new URL("./out/", import.meta.url);
mkdirSync(out, { recursive: true });
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
for (const line of script.lines) {
  const audio = await tts.generate(line.text, { voice: script.voice, speed: script.speed });
  audio.save(new URL(`${line.id}.wav`, out).pathname);
  console.log(`${line.id}: ${(audio.audio.length / audio.sampling_rate).toFixed(1)}s`);
}
