import express from "express";
import ffmpegPath from "ffmpeg-static";
import { EdgeTTS } from "edge-tts-universal";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseScript, ScriptParseError } from "./lib/script-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number.parseInt(process.env.PORT || "4173", 10);

const VOICES = [
  { id: "en-GB-RyanNeural", name: "Ryan", accent: "British", gender: "Male" },
  { id: "en-GB-SoniaNeural", name: "Sonia", accent: "British", gender: "Female" },
  { id: "en-GB-ThomasNeural", name: "Thomas", accent: "British", gender: "Male" },
  { id: "en-US-GuyNeural", name: "Guy", accent: "American", gender: "Male" },
  { id: "en-US-JennyNeural", name: "Jenny", accent: "American", gender: "Female" },
  { id: "en-US-AriaNeural", name: "Aria", accent: "American", gender: "Female" },
  { id: "en-AU-WilliamNeural", name: "William", accent: "Australian", gender: "Male" },
  { id: "en-AU-NatashaNeural", name: "Natasha", accent: "Australian", gender: "Female" },
  { id: "en-IE-ConnorNeural", name: "Connor", accent: "Irish", gender: "Male" },
  { id: "en-IE-EmilyNeural", name: "Emily", accent: "Irish", gender: "Female" }
];

const voiceIds = new Set(VOICES.map((voice) => voice.id));
const AUDIO_EFFECTS = {
  clean: null,
  light: "highpass=f=180,lowpass=f=4200,acompressor=threshold=0.18:ratio=2.5:attack=10:release=100:makeup=1.1",
  vhf: "highpass=f=300,lowpass=f=3400,equalizer=f=1600:t=q:w=1:g=3,acompressor=threshold=0.14:ratio=3.5:attack=5:release=80:makeup=1.25",
  muffled: "highpass=f=350,lowpass=f=2300,equalizer=f=1200:t=q:w=1.2:g=2,acompressor=threshold=0.12:ratio=4.5:attack=5:release=100:makeup=1.35"
};

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/voices", (_request, response) => {
  response.json(VOICES);
});

app.post("/api/preview", async (request, response) => {
  try {
    const text = cleanPreviewText(request.body?.text);
    const voice = validateVoice(request.body?.voice);
    const rate = validateRate(request.body?.rate);
    const radioEffect = validateRadioEffect(request.body?.radioEffect);
    const cleanAudio = await synthesize(text, voice, rate);
    const audio = await applyAudioEffect(cleanAudio, radioEffect);

    response.type("audio/mpeg");
    response.set("Cache-Control", "no-store");
    response.send(audio);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/generate", async (request, response) => {
  let workDirectory;

  try {
    const dialogue = parseScript(request.body?.script);
    const atcVoice = validateVoice(request.body?.atcVoice);
    const pilotVoice = validateVoice(request.body?.pilotVoice);
    const atcRate = validateRate(request.body?.atcRate);
    const pilotRate = validateRate(request.body?.pilotRate);
    const pauseMs = validatePause(request.body?.pauseMs);
    const radioEffect = validateRadioEffect(request.body?.radioEffect);

    if (atcVoice === pilotVoice) {
      throw new ClientError("Choose two different voices so the speakers are easy to distinguish.");
    }

    workDirectory = await mkdtemp(path.join(tmpdir(), "atc-dialogue-"));
    const audioBuffers = await mapWithConcurrency(dialogue, 3, (line) =>
      synthesize(
        line.text,
        line.role === "atc" ? atcVoice : pilotVoice,
        line.role === "atc" ? atcRate : pilotRate
      )
    );

    const segmentPaths = [];
    for (let index = 0; index < audioBuffers.length; index += 1) {
      const segmentPath = path.join(workDirectory, `segment-${String(index).padStart(3, "0")}.mp3`);
      await writeFile(segmentPath, audioBuffers[index]);
      segmentPaths.push(segmentPath);
    }

    const outputPath = path.join(workDirectory, "atc-dialogue.mp3");
    await joinAudio(segmentPaths, pauseMs, radioEffect, workDirectory, outputPath);
    const output = await readFile(outputPath);

    response.type("audio/mpeg");
    response.set({
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="atc-dialogue.mp3"',
      "X-Dialogue-Lines": String(dialogue.length)
    });
    response.send(output);
  } catch (error) {
    sendError(response, error);
  } finally {
    if (workDirectory) {
      await rm(workDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.use((error, _request, response, _next) => {
  sendError(response, error);
});

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`ATC Dialogue Studio is ready at http://localhost:${port}`);
  });
}

export { app };

class ClientError extends Error {}

function cleanPreviewText(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ClientError("Enter a short preview phrase.");
  }
  return value.trim().slice(0, 400);
}

function validateVoice(value) {
  if (!voiceIds.has(value)) {
    throw new ClientError("Choose a voice from the available list.");
  }
  return value;
}

function validateRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < -30 || rate > 30) {
    throw new ClientError("Speech rate must be between -30% and +30%.");
  }
  return `${rate >= 0 ? "+" : ""}${Math.round(rate)}%`;
}

function validatePause(value) {
  const pause = Number(value);
  if (!Number.isFinite(pause) || pause < 100 || pause > 3000) {
    throw new ClientError("The pause must be between 100 and 3,000 milliseconds.");
  }
  return Math.round(pause);
}

function validateRadioEffect(value) {
  const effect = typeof value === "string" ? value : "clean";
  if (!Object.hasOwn(AUDIO_EFFECTS, effect)) {
    throw new ClientError("Choose a valid transmission sound effect.");
  }
  return effect;
}

async function synthesize(text, voice, rate) {
  const tts = new EdgeTTS(text, voice, { rate, volume: "+0%", pitch: "+0Hz" });
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  if (buffer.length === 0) throw new Error("The voice service returned no audio.");
  return buffer;
}

async function mapWithConcurrency(items, limit, operation) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function applyAudioEffect(audio, effect) {
  const filter = AUDIO_EFFECTS[effect];
  if (!filter) return audio;

  const directory = await mkdtemp(path.join(tmpdir(), "atc-preview-"));
  try {
    const inputPath = path.join(directory, "input.mp3");
    const outputPath = path.join(directory, "output.mp3");
    await writeFile(inputPath, audio);
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-i", inputPath,
      "-af", filter, "-c:a", "libmp3lame", "-b:a", "96k", outputPath
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

async function joinAudio(segmentPaths, pauseMs, effect, directory, outputPath) {
  if (!ffmpegPath) throw new Error("The bundled audio encoder is unavailable.");

  const silencePath = path.join(directory, "silence.mp3");
  await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-f", "lavfi",
    "-i", "anullsrc=r=24000:cl=mono", "-t", String(pauseMs / 1000),
    "-c:a", "libmp3lame", "-b:a", "48k", silencePath
  ]);

  const concatLines = [];
  segmentPaths.forEach((segmentPath, index) => {
    concatLines.push(`file '${escapeConcatPath(segmentPath)}'`);
    if (index < segmentPaths.length - 1) {
      concatLines.push(`file '${escapeConcatPath(silencePath)}'`);
    }
  });

  const concatPath = path.join(directory, "concat.txt");
  await writeFile(concatPath, concatLines.join("\n"), "utf8");
  const outputArgs = [
    "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
    "-i", concatPath, "-vn"
  ];
  const filter = AUDIO_EFFECTS[effect];
  if (filter) outputArgs.push("-af", filter);
  outputArgs.push("-c:a", "libmp3lame", "-b:a", "96k", outputPath);
  await runFfmpeg(outputArgs);
}

function escapeConcatPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Audio assembly failed${stderr ? `: ${stderr.trim()}` : "."}`));
    });
  });
}

function sendError(response, error) {
  const isClientError = error instanceof ClientError || error instanceof ScriptParseError;
  if (!isClientError) console.error(error);
  response.status(isClientError ? 400 : 502).json({
    error: isClientError
      ? error.message
      : "Voice generation failed. Check the internet connection and try again."
  });
}
