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
  timeout: ReturnType<typeof setTimeout>;
};

let audioWorker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();
const statusListeners = new Set<(status: EngineStatus) => void>();

function stopWorker(error: Error) {
  pendingRequests.forEach((pending) => {
    clearTimeout(pending.timeout);
    pending.reject(error);
  });
  pendingRequests.clear();
  audioWorker?.terminate();
  audioWorker = null;
}

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
    clearTimeout(pending.timeout);
    if (message.type === "error") {
      pending.reject(new Error(message.message));
    } else {
      pending.resolve(message);
    }
  });
  audioWorker.addEventListener("error", (event) => {
    stopWorker(new Error(event.message || "The voice engine stopped unexpectedly."));
  });

  return audioWorker;
}

function request<T>(
  payload: Record<string, unknown>,
  transfer: Transferable[] = [],
  timeoutMs = 180_000
) {
  const worker = getWorker();
  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pendingRequests.has(id)) return;
      stopWorker(new Error("Generation timed out. Reload the page and try a shorter dialogue."));
    }, timeoutMs);
    pendingRequests.set(id, { resolve, reject, timeout });
    try {
      worker.postMessage({ id, ...payload }, transfer);
    } catch (error) {
      pendingRequests.delete(id);
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error("The voice engine could not start."));
    }
  });
}

export function subscribeToEngineStatus(listener: (status: EngineStatus) => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export async function warmVoiceEngine() {
  await request({ type: "warmup" }, [], 480_000);
}

export async function makeVoicePreview(text: string, voice: string, speed: number): Promise<AudioResult> {
  const result = await request<{ buffer: ArrayBuffer; sampleRate: number }>({
    type: "preview",
    text,
    voice,
    speed
  }, [], 240_000);
  return { samples: new Float32Array(result.buffer), sampleRate: result.sampleRate };
}

export async function makeDialogueAudio(lines: DialogueRequestLine[], pauseMs: number): Promise<AudioResult> {
  const result = await request<{ buffer: ArrayBuffer; sampleRate: number }>({
    type: "dialogue",
    lines,
    pauseMs
  }, [], Math.max(360_000, lines.length * 90_000));
  return { samples: new Float32Array(result.buffer), sampleRate: result.sampleRate };
}

export async function makeMp3(samples: Float32Array, sampleRate: number) {
  const buffer = samples.buffer as ArrayBuffer;
  const result = await request<{ buffer: ArrayBuffer }>({
    type: "encode",
    buffer,
    sampleRate
  }, [buffer], 240_000);
  return new Blob([result.buffer], { type: "audio/mpeg" });
}
