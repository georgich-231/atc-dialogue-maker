type EngineStatus = {
  message: string;
  engine?: "gpu" | "cpu";
};

type DialogueRequestLine = {
  text: string;
  voice: string;
  speed: number;
};

type AudioResult = {
  samples: Float32Array;
  sampleRate: number;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
};

let audioWorker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();
const statusListeners = new Set<(status: EngineStatus) => void>();

function getWorker() {
  if (audioWorker) return audioWorker;
  if (typeof Worker === "undefined") throw new Error("This browser cannot run the voice engine.");

  audioWorker = new Worker(new URL("./audio.worker.ts", import.meta.url), { type: "module" });
  audioWorker.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "status") {
      statusListeners.forEach((listener) => listener(message));
      return;
    }

    const pending = pendingRequests.get(message.id);
    if (!pending) return;
    pendingRequests.delete(message.id);
    if (message.type === "error") {
      pending.reject(new Error(message.message));
    } else {
      pending.resolve(message);
    }
  });
  audioWorker.addEventListener("error", (event) => {
    const error = new Error(event.message || "The voice engine stopped unexpectedly.");
    pendingRequests.forEach((pending) => pending.reject(error));
    pendingRequests.clear();
    audioWorker?.terminate();
    audioWorker = null;
  });

  return audioWorker;
}

function request<T>(payload: Record<string, unknown>, transfer: Transferable[] = []) {
  const worker = getWorker();
  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, ...payload }, transfer);
  });
}

export function subscribeToEngineStatus(listener: (status: EngineStatus) => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export async function warmVoiceEngine() {
  await request({ type: "warmup" });
}

export async function makeVoicePreview(text: string, voice: string, speed: number): Promise<AudioResult> {
  const result = await request<{ buffer: ArrayBuffer; sampleRate: number }>({
    type: "preview",
    text,
    voice,
    speed
  });
  return { samples: new Float32Array(result.buffer), sampleRate: result.sampleRate };
}

export async function makeDialogueAudio(lines: DialogueRequestLine[], pauseMs: number): Promise<AudioResult> {
  const result = await request<{ buffer: ArrayBuffer; sampleRate: number }>({
    type: "dialogue",
    lines,
    pauseMs
  });
  return { samples: new Float32Array(result.buffer), sampleRate: result.sampleRate };
}

export async function makeMp3(samples: Float32Array, sampleRate: number) {
  const buffer = samples.buffer as ArrayBuffer;
  const result = await request<{ buffer: ArrayBuffer }>({
    type: "encode",
    buffer,
    sampleRate
  }, [buffer]);
  return new Blob([result.buffer], { type: "audio/mpeg" });
}
