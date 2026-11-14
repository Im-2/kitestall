// Composes the final video: scene clips (time-fitted to the narration), slides, narration audio (loudness-normalised) and burned-in captions.
// Inputs: out/video/raw/*.mp4, out/video/slides/*.png, out/video/audio/*.mp3+json.  Output: out/video/kitestall-demo.mp4 and .srt
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
const n = JSON.parse(readFileSync("scripts/video/narration.json", "utf8"));
const TEMPO = 1.04, LEAD = 1.0, GAP = 0.35, TAIL = 3.5, TITLE = 5.0, FADE = 0.2;
const run = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const W = "out/video/work"; mkdirSync(W, { recursive: true });

// ---- timeline
const sc = n.scenes.map((s) => { const meta = JSON.parse(readFileSync(`out/video/audio/${s.id}.json`, "utf8")); return { ...s, meta, dur: probe(`out/video/audio/${s.id}.mp3`) / TEMPO }; });
let t = 0;
sc.forEach((s, i) => { s.audioStart = t + (i === 0 ? LEAD : 0); s.slot = (i === 0 ? LEAD : 0) + s.dur + (i === sc.length - 1 ? TAIL : GAP); s.videoStart = t; t += s.slot; });
const total = t; console.log("scene slots (s):", sc.map((s) => s.slot.toFixed(1)).join(", "), "| total", total.toFixed(1));
const timeOf = (s, needle) => { const text = s.meta.alignment.characters.join(""); const i = text.indexOf(needle); if (i < 0) throw new Error("needle not found: " + needle); return s.meta.alignment.character_start_times_seconds[i] / TEMPO; };

// ---- video segments
const segs = []; let k = 0;
const clip = (src, ss, len, slot) => { // fit [ss, ss+len] of a recording into `slot` seconds (speed-up or slow-down), with fades
  const out = `${W}/seg${k++}.mp4`; const f = slot / len;
  run(["-ss", String(ss), "-t", String(len), "-i", src, "-vf", `setpts=PTS*${f.toFixed(5)},fps=30,scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(slot - FADE).toFixed(3)}:d=${FADE}`, "-t", slot.toFixed(3), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out]);
  console.log(`  ${src.split("/").pop()} [${ss}..${ss + len}] -> ${slot.toFixed(1)}s (x${(len / slot).toFixed(2)} speed)`); segs.push(out);
};
const still = (png, slot) => { const out = `${W}/seg${k++}.mp4`; run(["-loop", "1", "-framerate", "30", "-t", slot.toFixed(3), "-i", png, "-vf", `scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(slot - FADE).toFixed(3)}:d=${FADE}`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out]); segs.push(out); };
const raw = (n_) => `out/video/raw/${n_}.mp4`;
// real decoded duration of a raw clip (screencasts can be shorter than wall-clock time)
const rawDur = (n_) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-i", raw(n_), "-f", "null", "-"], { encoding: "utf8" }); const m = [...r.stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].at(-1); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };
const [s1, s2, s3, s4, s5, s6, s7] = sc;
still("out/video/slides/title.png", TITLE); clip(raw("landing"), 3.5, 13, s1.slot - TITLE);
clip(raw("landing"), 18, 38, s2.slot);
clip(raw("arena"), 2.5, 90.5, s3.slot);
clip(raw("storya"), 2.5, rawDur("storya") - 2.5, s4.slot);
clip(raw("verify"), 3.5, rawDur("verify") - 3.5, s5.slot);
clip(raw("owner"), 8, Math.min(rawDur("owner") - 8, 28), s6.slot);
const tHonest = timeOf(s7, "To be clear"), tEnd = timeOf(s7, "Kitestall: the seller");
still("out/video/slides/results.png", tHonest + (s7.audioStart - s7.videoStart)); still("out/video/slides/honest.png", tEnd - tHonest); still("out/video/slides/end.png", s7.slot - tEnd - (s7.audioStart - s7.videoStart));
writeFileSync(`${W}/list.txt`, segs.map((f) => `file '${f.replace(/^out\/video\/work\//, "")}'`).join("\n"));
run(["-f", "concat", "-safe", "0", "-i", `${W}/list.txt`, "-c", "copy", `${W}/video.mp4`]);

// ---- audio (tempo-adjusted, padded to each slot, concatenated, loudness-normalised)
const parts = sc.map((s, i) => { const out = `${W}/a${i}.wav`; const lead = i === 0 ? LEAD : 0; run(["-i", `out/video/audio/${s.id}.mp3`, "-af", `atempo=${TEMPO},adelay=${Math.round(lead * 1000)}:all=1,apad=whole_dur=${s.slot.toFixed(3)}`, "-ar", "44100", "-ac", "2", out]); return out; });
writeFileSync(`${W}/alist.txt`, parts.map((f) => `file '${f.replace(/^out\/video\/work\//, "")}'`).join("\n"));
run(["-f", "concat", "-safe", "0", "-i", `${W}/alist.txt`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "44100", `${W}/audio.wav`]);

// ---- captions (SRT from the character-level alignment; spoken forms mapped to display forms)
const disp = (s) => n.display.reduce((a, [x, y]) => a.split(x).join(y), s);
const cues = [];
for (const s of sc) {
  const { characters: ch, character_start_times_seconds: st, character_end_times_seconds: en } = s.meta.alignment;
  const words = []; let cur = null;
  ch.forEach((c, i) => { if (/\s/.test(c)) { if (cur) { words.push(cur); cur = null; } } else if (cur) { cur.text += c; cur.end = en[i]; } else cur = { text: c, start: st[i], end: en[i] }; }); if (cur) words.push(cur);
  let q = null;
  const flush = () => { if (q) { cues.push({ a: s.audioStart + q.start / TEMPO, b: s.audioStart + q.end / TEMPO, text: disp(q.words.join(" ")) }); q = null; } };
  for (const w of words) { if (!q) q = { start: w.start, end: w.end, words: [] }; q.words.push(w.text); q.end = w.end; const len = q.words.join(" ").length;
    if (/[.?!]$/.test(w.text) || (/,$/.test(w.text) && len > 42) || len > 85 || (q.end - q.start) / TEMPO > 7) flush(); }
  flush();
}
const ts = (x) => { const ms = Math.round(x * 1000); const p = (v, l = 2) => String(v).padStart(l, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
cues.forEach((c, i) => { if (i + 1 < cues.length) c.b = Math.min(c.b + 0.25, cues[i + 1].a - 0.02); else c.b += 0.3; });
writeFileSync("out/video/kitestall-demo.srt", cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join("\n"));
console.log("captions:", cues.length, "cues");

// ---- final encode: burn captions, mux audio
const style = "FontName=Arial,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BackColour=&H80000000,BorderStyle=1,Outline=1,Shadow=0,Alignment=2,MarginV=16,MarginL=60,MarginR=60";
run(["-i", `${W}/video.mp4`, "-i", `${W}/audio.wav`, "-vf", `subtitles=out/video/kitestall-demo.srt:force_style='${style}'`, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(3), "out/video/kitestall-demo.mp4"]);
console.log("DONE out/video/kitestall-demo.mp4", probe("out/video/kitestall-demo.mp4").toFixed(1) + "s");
