// Generates the narration scene by scene with ElevenLabs (with character-level timestamps). Each scene is generated ONCE and cached by a hash of
// (text + voice + model + settings); unchanged scenes are never regenerated. Usage: node scripts/video/tts.mjs [--dry]   (--dry: print character counts only)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadEnv } from "../_env.mjs";
loadEnv();
const n = JSON.parse(readFileSync("scripts/video/narration.json", "utf8"));
mkdirSync("out/video/audio", { recursive: true });
const total = n.scenes.reduce((a, s) => a + s.text.length, 0);
console.log(`voice ${n.voice} (${n.voice_id}), model ${n.model}; ${n.scenes.length} scenes, ${total} characters`);
if (process.argv.includes("--dry")) process.exit(0);
const key = process.env.ELEVENLABS_API_KEY; if (!key) { console.error("ELEVENLABS_API_KEY missing in .env"); process.exit(2); }
let spent = 0;
for (const s of n.scenes) {
  const hash = createHash("sha256").update(JSON.stringify([s.text, n.voice_id, n.model, n.voice_settings])).digest("hex").slice(0, 16);
  const meta = `out/video/audio/${s.id}.json`, mp3 = `out/video/audio/${s.id}.mp3`;
  if (existsSync(meta) && existsSync(mp3) && JSON.parse(readFileSync(meta, "utf8")).hash === hash) { console.log(`cached  ${s.id}`); continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${n.voice_id}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text: s.text, model_id: n.model, voice_settings: n.voice_settings }),
  });
  if (!r.ok) { console.error(`FAILED ${s.id}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const j = await r.json();
  writeFileSync(mp3, Buffer.from(j.audio_base64, "base64"));
  writeFileSync(meta, JSON.stringify({ hash, id: s.id, chars: s.text.length, alignment: j.alignment }));
  spent += s.text.length; console.log(`generated ${s.id} (${s.text.length} chars)`);
}
console.log(`characters spent this run: ${spent}`);
