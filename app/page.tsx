"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "atc" | "pilot";
type EffectName = "clean" | "light" | "vhf" | "muffled";
type DialogueLine = { role: Role; text: string };
type Voice = { id: string; name: string; accent: string; gender: "Male" | "Female" };
type GeneratedAudio = { audio: Float32Array; sampling_rate: number };

const voices: Voice[] = [
  { id: "bm_george", name: "George", accent: "British", gender: "Male" },
  { id: "bm_fable", name: "Fable", accent: "British", gender: "Male" },
  { id: "bm_daniel", name: "Daniel", accent: "British", gender: "Male" },
  { id: "bm_lewis", name: "Lewis", accent: "British", gender: "Male" },
  { id: "am_michael", name: "Michael", accent: "American", gender: "Male" },
  { id: "am_fenrir", name: "Fenrir", accent: "American", gender: "Male" },
  { id: "am_puck", name: "Puck", accent: "American", gender: "Male" },
  { id: "am_eric", name: "Eric", accent: "American", gender: "Male" },
  { id: "am_onyx", name: "Onyx", accent: "American", gender: "Male" },
  { id: "am_liam", name: "Liam", accent: "American", gender: "Male" },
  { id: "bf_emma", name: "Emma", accent: "British", gender: "Female" },
  { id: "bf_isabella", name: "Isabella", accent: "British", gender: "Female" },
  { id: "af_heart", name: "Heart", accent: "American", gender: "Female" },
  { id: "af_bella", name: "Bella", accent: "American", gender: "Female" }
];

const sampleScript = `ATC: Balkan one two three, Sofia Tower, wind two eight zero degrees, six knots, runway two seven, cleared for takeoff.

PILOT: Cleared for takeoff runway two seven, Balkan one two three.

ATC: Balkan one two three, contact Sofia Departure on one two four decimal six.

PILOT: One two four decimal six, Balkan one two three, good day.`;

const effectCopy: Record<EffectName, string> = {
  clean: "Unfiltered output.",
  light: "Light band-pass filter.",
  vhf: "VHF band-pass and compression.",
  muffled: "Narrow, low-detail band-pass."
};

let modelPromise: Promise<any> | null = null;

async function getVoiceModel(onProgress: (message: string) => void) {
  if (!modelPromise) {
    modelPromise = (async () => {
      onProgress("Loading the voice model for the first time…");
      const { KokoroTTS } = await import("kokoro-js");
      const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (progress: { status?: string; progress?: number }) => {
          if (progress.status === "progress" && Number.isFinite(progress.progress)) {
            onProgress(`Loading voice model… ${Math.round(progress.progress ?? 0)}%`);
          }
        }
      } as any);
      onProgress("Voice model ready.");
      return model;
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

export default function DialogueMaker() {
  const [script, setScript] = useState(sampleScript);
  const [atcVoice, setAtcVoice] = useState("bm_george");
  const [pilotVoice, setPilotVoice] = useState("am_michael");
  const [atcRate, setAtcRate] = useState(0);
  const [pilotRate, setPilotRate] = useState(0);
  const [pauseMs, setPauseMs] = useState(650);
  const [effect, setEffect] = useState<EffectName>("vhf");
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  const transmissionCount = useMemo(() => {
    return script.split(/\r?\n/).filter((line) => /^(atc|controller|tower|ground|approach|departure|pilot|aircraft|flight)\s*:/i.test(line.trim())).length;
  }, [script]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  async function preview(role: Role) {
    setBusy(true);
    setError("");
    try {
      const model = await getVoiceModel(setStatus);
      setStatus(`Making the ${role === "atc" ? "controller" : "pilot"} preview…`);
      const generated = await model.generate(
        role === "atc"
          ? "Balkan one two three, Sofia Tower, runway two seven, cleared for takeoff."
          : "Cleared for takeoff runway two seven, Balkan one two three.",
        {
          voice: role === "atc" ? atcVoice : pilotVoice,
          speed: rateToSpeed(role === "atc" ? atcRate : pilotRate)
        }
      ) as GeneratedAudio;
      const filtered = await applyEffect(generated.audio, generated.sampling_rate, effect);
      const previewBlob = encodeWav(filtered, generated.sampling_rate);
      if (previewAudio.current) {
        previewAudio.current.pause();
        URL.revokeObjectURL(previewAudio.current.src);
      }
      previewAudio.current = new Audio(URL.createObjectURL(previewBlob));
      await previewAudio.current.play();
      setStatus("Preview playing.");
    } catch (previewError) {
      setError(readableError(previewError));
      setStatus("Preview could not be made.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDialogue() {
    setBusy(true);
    setError("");
    try {
      const dialogue = parseScript(script);
      if (atcVoice === pilotVoice) throw new Error("Choose two different voices so the speakers are easy to distinguish.");

      const model = await getVoiceModel(setStatus);
      const clips: GeneratedAudio[] = [];
      for (let index = 0; index < dialogue.length; index += 1) {
        const line = dialogue[index];
        setStatus(`Making transmission ${index + 1} of ${dialogue.length}…`);
        clips.push(await model.generate(line.text, {
          voice: line.role === "atc" ? atcVoice : pilotVoice,
          speed: rateToSpeed(line.role === "atc" ? atcRate : pilotRate)
        }) as GeneratedAudio);
      }

      setStatus("Adding pauses and the selected radio sound…");
      const sampleRate = clips[0].sampling_rate;
      const joined = joinClips(clips, pauseMs, sampleRate);
      const filtered = await applyEffect(joined, sampleRate, effect);
      setStatus("Preparing the MP3…");
      const mp3Blob = await encodeMp3(filtered, sampleRate);
      const nextUrl = URL.createObjectURL(mp3Blob);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(nextUrl);
      setResultLabel(`${dialogue.length} transmissions · ${effectLabel(effect)}`);
      setStatus("Done.");
    } catch (generationError) {
      setError(readableError(generationError));
      setStatus("The dialogue was not generated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="maker-shell">
      <section className="intro-card">
        <div className="personal-label"><span>ATC / PILOT</span><i aria-hidden="true" /></div>
        <h1>Dialogue<br />Maker.</h1>
        <div className="format-list" aria-label="Output format">
          <span>Script</span>
          <span>2 voices</span>
          <span>MP3</span>
        </div>
      </section>

      <section className="work-card">
        <div className="script-title-row">
          <div>
            <p className="mini-label">Script</p>
            <h2>ATC / Pilot</h2>
          </div>
          <div className="small-actions">
            <button type="button" onClick={() => setScript(sampleScript)}>Example</button>
            <button type="button" onClick={() => setScript("")}>Clear</button>
          </div>
        </div>

        <label className="sr-only" htmlFor="script">ATC and pilot script</label>
        <textarea id="script" value={script} onChange={(event) => setScript(event.target.value)} spellCheck placeholder={"ATC: Controller transmission\n\nPILOT: Pilot response"} />
        <div className="under-script">
          <span><b>ATC:</b> / <b>PILOT:</b></span>
          <strong>{transmissionCount} transmission{transmissionCount === 1 ? "" : "s"}</strong>
        </div>

        <div className="status-line" aria-live="polite">
          <span className={busy ? "pulse" : ""} aria-hidden="true" />
          <p className={error ? "error" : ""}>{error || status}</p>
        </div>

        <button className="make-button" type="button" disabled={busy} onClick={generateDialogue}>
          <span>{busy ? "Generating…" : "Generate MP3"}</span>
          <small>MP3</small>
        </button>

        {resultUrl && (
          <div className="result-box">
            <div><b>Ready</b><span>{resultLabel}</span></div>
            <audio controls src={resultUrl} />
            <a href={resultUrl} download="atc-dialogue.mp3">Save MP3</a>
          </div>
        )}
      </section>

      <aside className="choices-card">
        <div className="choices-heading">
          <p className="mini-label">Audio</p>
          <h2>Voices &amp; effect</h2>
        </div>

        <VoiceChoice
          number="1"
          role="Controller"
          color="blue"
          value={atcVoice}
          rate={atcRate}
          disabled={busy}
          onVoice={setAtcVoice}
          onRate={setAtcRate}
          onPreview={() => preview("atc")}
        />
        <VoiceChoice
          number="2"
          role="Pilot"
          color="orange"
          value={pilotVoice}
          rate={pilotRate}
          disabled={busy}
          onVoice={setPilotVoice}
          onRate={setPilotRate}
          onPreview={() => preview("pilot")}
        />

        <div className="field-block compact-field">
          <label htmlFor="pause">Reply gap</label>
          <select id="pause" value={pauseMs} onChange={(event) => setPauseMs(Number(event.target.value))}>
            <option value={350}>Quick · 0.35 seconds</option>
            <option value={650}>Natural · 0.65 seconds</option>
            <option value={1000}>Measured · 1 second</option>
            <option value={1500}>Long · 1.5 seconds</option>
          </select>
        </div>

        <div className="field-block compact-field last-field">
          <label htmlFor="effect">Radio effect</label>
          <select id="effect" value={effect} onChange={(event) => setEffect(event.target.value as EffectName)}>
            <option value="clean">Clean voice</option>
            <option value="light">Light radio</option>
            <option value="vhf">VHF radio</option>
            <option value="muffled">Muffled recording</option>
          </select>
          <p>{effectCopy[effect]}</p>
        </div>
      </aside>

      <p className="local-note">Voice model downloads on first use.</p>
    </main>
  );
}

function VoiceChoice({ number, role, color, value, rate, disabled, onVoice, onRate, onPreview }: {
  number: string;
  role: string;
  color: "blue" | "orange";
  value: string;
  rate: number;
  disabled: boolean;
  onVoice: (value: string) => void;
  onRate: (value: number) => void;
  onPreview: () => void;
}) {
  const maleVoices = voices.filter((voice) => voice.gender === "Male");
  const femaleVoices = voices.filter((voice) => voice.gender === "Female");
  return (
    <div className="voice-choice">
      <div className="role-heading">
        <span className={color}>{number}</span>
        <div><b>{role}</b></div>
      </div>
      <div className="voice-select-row">
        <label className="sr-only" htmlFor={`${role}-voice`}>{role} voice</label>
        <select id={`${role}-voice`} value={value} onChange={(event) => onVoice(event.target.value)}>
          <optgroup label="Male voices">
            {maleVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.accent} · Male</option>)}
          </optgroup>
          <optgroup label="Female voices">
            {femaleVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.accent} · Female</option>)}
          </optgroup>
        </select>
        <button type="button" disabled={disabled} onClick={onPreview} aria-label={`Preview ${role.toLowerCase()} voice`}>▶</button>
      </div>
      <label className="rate-label" htmlFor={`${role}-rate`}><span>Rate</span><b>{rate > 0 ? "+" : ""}{rate}%</b></label>
      <input id={`${role}-rate`} type="range" min="-30" max="30" step="5" value={rate} onChange={(event) => onRate(Number(event.target.value))} />
    </div>
  );
}

function parseScript(input: string): DialogueLine[] {
  if (!input.trim()) throw new Error("Paste a dialogue script first.");
  if (input.length > 12_000) throw new Error("Keep the script under 12,000 characters.");

  const aliases: Record<string, Role> = {
    atc: "atc", controller: "atc", tower: "atc", ground: "atc", approach: "atc", departure: "atc",
    pilot: "pilot", aircraft: "pilot", flight: "pilot"
  };
  const dialogue: DialogueLine[] = [];
  for (const [index, sourceLine] of input.replace(/\r\n/g, "\n").split("\n").entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const match = line.match(/^([^:]{1,24}):\s*(.+)$/);
    if (match) {
      const role = aliases[match[1].trim().toLowerCase()];
      if (!role) throw new Error(`Unknown speaker “${match[1].trim()}” on line ${index + 1}. Use ATC: or PILOT:.`);
      dialogue.push({ role, text: match[2].trim() });
    } else if (dialogue.length) {
      dialogue[dialogue.length - 1].text += ` ${line}`;
    } else {
      throw new Error(`Line ${index + 1} needs ATC: or PILOT: at the start.`);
    }
  }
  if (dialogue.length < 2) throw new Error("Add at least two transmissions.");
  if (dialogue.length > 40) throw new Error("Keep the dialogue to 40 transmissions or fewer.");
  if (!dialogue.some((line) => line.role === "atc") || !dialogue.some((line) => line.role === "pilot")) {
    throw new Error("The script needs both an ATC: line and a PILOT: line.");
  }
  return dialogue;
}

function rateToSpeed(rate: number) {
  return Math.max(0.7, Math.min(1.3, 1 + rate / 100));
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

async function applyEffect(samples: Float32Array, sampleRate: number, effect: EffectName) {
  if (effect === "clean") return samples.slice();
  const context = new OfflineAudioContext(1, samples.length, sampleRate);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(Float32Array.from(samples), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;

  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = effect === "light" ? 180 : effect === "vhf" ? 300 : 350;
  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = effect === "light" ? 4200 : effect === "vhf" ? 3400 : 2300;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = effect === "light" ? -18 : effect === "vhf" ? -20 : -22;
  compressor.ratio.value = effect === "light" ? 2.5 : effect === "vhf" ? 3.5 : 4.5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.08;
  const gain = context.createGain();
  gain.gain.value = effect === "light" ? 1.05 : effect === "vhf" ? 1.1 : 1.15;

  source.connect(highPass).connect(lowPass).connect(compressor).connect(gain).connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return rendered.getChannelData(0).slice();
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function encodeMp3(samples: Float32Array, sampleRate: number) {
  const lame = await import("@breezystack/lamejs");
  const encoder = new lame.Mp3Encoder(1, sampleRate, 96);
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const chunks: BlobPart[] = [];
  for (let offset = 0; offset < pcm.length; offset += 1152) {
    const chunk = encoder.encodeBuffer(pcm.subarray(offset, offset + 1152));
    if (chunk.length) chunks.push(new Uint8Array(chunk));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  return new Blob(chunks, { type: "audio/mpeg" });
}

function writeText(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function effectLabel(effect: EffectName) {
  return { clean: "Clean voice", light: "Light radio", vhf: "VHF radio", muffled: "Muffled recording" }[effect];
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while making the audio. Please try again.";
}
