import { applyRecordingBed, type RecordingBed } from "./recording-bed";

type Engine = {
  device: "webgpu" | "wasm";
  dtype: "fp32" | "q8";
  label: "gpu" | "cpu";
};

type GeneratedAudio = {
  audio: Float32Array;
  sampling_rate: number;
};

type DialogueLine = {
  text: string;
  voice: string;
  speed: number;
  accent: string;
};

type WorkerRequest = {
  id: number;
  type: "warmup" | "preview" | "dialogue" | "encode";
  text?: string;
  voice?: string;
  speed?: number;
  accent?: string;
  lines?: DialogueLine[];
  pauseMs?: number;
  buffer?: ArrayBuffer;
  sampleRate?: number;
  recordingBed?: string;
};

type WorkerScope = {
  navigator: Navigator;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent<WorkerRequest>) => void) => void;
};

const workerScope = globalThis as unknown as WorkerScope;
let modelPromise: Promise<any> | null = null;
let activeEngine: Engine | null = null;
let isAppleMobile = false;

function postStatus(message: string, engine?: Engine["label"]) {
  workerScope.postMessage({ type: "status", message, engine });
}

function detectAppleMobile() {
  const navigatorWithTouch = workerScope.navigator as Navigator & {
    platform?: string;
    maxTouchPoints?: number;
  };
  return /iPad|iPhone|iPod/i.test(navigatorWithTouch.userAgent) ||
    (navigatorWithTouch.platform === "MacIntel" && (navigatorWithTouch.maxTouchPoints ?? 0) > 1);
}

async function prepareAppleRuntime() {
  isAppleMobile = detectAppleMobile();
  if (!isAppleMobile) return;

  postStatus("iOS compatibility engine loading…", "cpu");
  const standardWasmModule = await import("onnxruntime-web/wasm");
  const standardWasm = standardWasmModule.env ? standardWasmModule : standardWasmModule.default;
  standardWasm.env.wasm.numThreads = 1;
  standardWasm.env.wasm.proxy = false;
  standardWasm.env.wasm.initTimeout = 120_000;
  standardWasm.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/";
  (globalThis as Record<PropertyKey, unknown>)[Symbol.for("onnxruntime")] = standardWasm;
}

async function chooseEngine(): Promise<Engine> {
  const navigatorWithHardware = workerScope.navigator as Navigator & {
    deviceMemory?: number;
    gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<unknown> };
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const connection = navigatorWithHardware.connection;
  const slowConnection = connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
  const desktopMemory = (navigatorWithHardware.deviceMemory ?? 0) >= 8;

  if (!isAppleMobile && navigatorWithHardware.gpu && desktopMemory && !slowConnection) {
    try {
      const adapter = await navigatorWithHardware.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (adapter) return { device: "webgpu", dtype: "fp32", label: "gpu" };
    } catch {
      // The WASM engine below is the compatibility path.
    }
  }
  return { device: "wasm", dtype: "q8", label: "cpu" };
}

async function loadModel() {
  await prepareAppleRuntime();
  const { KokoroTTS } = await import("kokoro-js");
  const preferred = await chooseEngine();

  async function load(engine: Engine) {
    postStatus(`${engine.label === "gpu" ? "GPU" : "CPU"} voice engine loading…`, engine.label);
    const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: engine.dtype,
      device: engine.device,
      progress_callback: (progress: { status?: string; progress?: number }) => {
        if (progress.status === "progress" && Number.isFinite(progress.progress)) {
          postStatus(`Voice engine loading… ${Math.round(progress.progress ?? 0)}%`, engine.label);
        }
      }
    });
    activeEngine = engine;
    postStatus(`Voice engine ready · ${engine.label.toUpperCase()}`, engine.label);
    return model;
  }

  try {
    return await load(preferred);
  } catch (error) {
    if (preferred.device === "webgpu") {
      postStatus("GPU unavailable · switching to CPU", "cpu");
      return load({ device: "wasm", dtype: "q8", label: "cpu" });
    }
    throw error;
  }
}

function getModel() {
  if (!modelPromise) {
    modelPromise = loadModel().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function joinClips(clips: GeneratedAudio[], pauseMs: number, sampleRate: number) {
  const pauseLength = Math.round(sampleRate * pauseMs / 1000);
  const totalLength = clips.reduce((sum, clip) => sum + clip.audio.length, 0) + pauseLength * (clips.length - 1);
  const output = new Float32Array(totalLength);
  let offset = 0;
  clips.forEach((clip, index) => {
    output.set(clip.audio, offset);
    offset += clip.audio.length;
    if (index < clips.length - 1) offset += pauseLength;
  });
  return output;
}

async function encodeMp3(samples: Float32Array, sampleRate: number) {
  const lame = await import("@breezystack/lamejs");
  const encoder = new lame.Mp3Encoder(1, sampleRate, 96);
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  for (let offset = 0; offset < pcm.length; offset += 1152) {
    const chunk = encoder.encodeBuffer(pcm.subarray(offset, offset + 1152));
    if (chunk.length) {
      const bytes = new Uint8Array(chunk);
      chunks.push(bytes);
      totalLength += bytes.length;
    }
  }
  const end = new Uint8Array(encoder.flush());
  if (end.length) {
    chunks.push(end);
    totalLength += end.length;
  }

  const output = new Uint8Array(totalLength);
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

const accentLanguages: Record<string, string> = {
  american: "en-us",
  british: "en",
  scottish: "en-gb-scotland",
  caribbean: "en-029",
  "new-york": "en-us-nyc",
  northern: "en-gb-x-gbclan",
  "west-midlands": "en-gb-x-gbcwmd",
  rp: "en-gb-x-rp",
  irish: "en-gb-scotland",
  indian: "en",
  italian: "en"
};

async function generateSpeech(model: any, text: string, voice: string, speed: number, accent = "native") {
  if (accent === "native") return model.generate(text, { voice, speed }) as Promise<GeneratedAudio>;

  const { phonemize } = await import("phonemizer");
  const language = accentLanguages[accent] ?? "en";
  const punctuation = /([;:,.!?¡¿—…“”()]+)/g;
  const sections = text.split(punctuation);
  const phonemeSections = await Promise.all(sections.map(async (section, index) => {
    if (!section || index % 2 === 1) return section;
    return (await phonemize(section, language)).join(" ");
  }));

  let phonemes = phonemeSections.join("")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l");

  if (accent === "irish") {
    phonemes = phonemes.replace(/θ/g, "t̪").replace(/ð/g, "d̪").replace(/ʉː/g, "uː");
  } else if (accent === "indian") {
    phonemes = phonemes.replace(/θ/g, "t̪").replace(/ð/g, "d̪");
  } else if (accent === "italian") {
    phonemes = phonemes
      .replace(/θ/g, "t")
      .replace(/ð/g, "d")
      .replace(/ɹ/g, "ɾ")
      .replace(/əʊ/g, "oː")
      .replace(/eɪ/g, "eː");
  }

  const { input_ids } = model.tokenizer(phonemes.trim(), { truncation: true });
  return model.generate_from_ids(input_ids, { voice, speed }) as Promise<GeneratedAudio>;
}

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    const request = event.data;
    try {
      if (request.type === "warmup") {
        await getModel();
        workerScope.postMessage({ type: "complete", id: request.id });
        return;
      }

      if (request.type === "preview") {
        const model = await getModel();
        postStatus("Generating preview…", activeEngine?.label);
        const generated = await generateSpeech(
          model,
          request.text ?? "",
          request.voice ?? "af_heart",
          request.speed ?? 1,
          request.accent
        );
        const output = generated.audio.slice();
        const buffer = output.buffer as ArrayBuffer;
        workerScope.postMessage({ type: "complete", id: request.id, buffer, sampleRate: generated.sampling_rate }, [buffer]);
        return;
      }

      if (request.type === "dialogue") {
        const model = await getModel();
        const lines = request.lines ?? [];
        const clips: GeneratedAudio[] = [];
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          postStatus(`Generating ${index + 1} / ${lines.length}…`, activeEngine?.label);
          clips.push(await generateSpeech(model, line.text, line.voice, line.speed, line.accent));
        }
        const sampleRate = clips[0].sampling_rate;
        const output = joinClips(clips, request.pauseMs ?? 650, sampleRate);
        const buffer = output.buffer as ArrayBuffer;
        workerScope.postMessage({ type: "complete", id: request.id, buffer, sampleRate }, [buffer]);
        return;
      }

      if (request.type === "encode") {
        postStatus("Encoding MP3…", activeEngine?.label);
        if (!request.buffer) throw new Error("Missing audio data.");
        const sampleRate = request.sampleRate ?? 24_000;
        const mixed = applyRecordingBed(
          new Float32Array(request.buffer),
          sampleRate,
          (request.recordingBed ?? "none") as RecordingBed
        );
        const mp3 = await encodeMp3(mixed, sampleRate);
        const buffer = mp3.buffer as ArrayBuffer;
        workerScope.postMessage({ type: "complete", id: request.id, buffer }, [buffer]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The voice engine failed.";
      workerScope.postMessage({ type: "error", id: request.id, message });
    }
  })();
});
