"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  makeDialogueAudio,
  makeMp3,
  makeVoicePreview,
  subscribeToEngineStatus,
  warmVoiceEngine
} from "../src/audio-worker-client";
import { makeCloudDialogueAudio, makeCloudVoicePreview } from "../src/azure-speech";
import { applyRecordingBed, type RecordingBed } from "../src/recording-bed";

type Role = "atc" | "pilot";
type VoiceEngine = "local" | "cloud";
type EffectName = "clean" | "light" | "vhf" | "muffled";
type AccentProfile = "native" | "american" | "british" | "scottish" | "caribbean" | "new-york" | "northern" | "west-midlands" | "rp";
type DialogueLine = { role: Role; text: string };
type Voice = { id: string; name: string; accent: string; gender: "Male" | "Female" };

const localVoices: Voice[] = [
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
  { id: "am_adam", name: "Adam", accent: "American", gender: "Male" },
  { id: "am_echo", name: "Echo", accent: "American", gender: "Male" },
  { id: "am_santa", name: "Santa", accent: "American", gender: "Male" },
  { id: "bf_emma", name: "Emma", accent: "British", gender: "Female" },
  { id: "bf_isabella", name: "Isabella", accent: "British", gender: "Female" },
  { id: "bf_alice", name: "Alice", accent: "British", gender: "Female" },
  { id: "bf_lily", name: "Lily", accent: "British", gender: "Female" },
  { id: "af_heart", name: "Heart", accent: "American", gender: "Female" },
  { id: "af_bella", name: "Bella", accent: "American", gender: "Female" },
  { id: "af_alloy", name: "Alloy", accent: "American", gender: "Female" },
  { id: "af_aoede", name: "Aoede", accent: "American", gender: "Female" },
  { id: "af_jessica", name: "Jessica", accent: "American", gender: "Female" },
  { id: "af_kore", name: "Kore", accent: "American", gender: "Female" },
  { id: "af_nicole", name: "Nicole", accent: "American", gender: "Female" },
  { id: "af_nova", name: "Nova", accent: "American", gender: "Female" },
  { id: "af_river", name: "River", accent: "American", gender: "Female" },
  { id: "af_sarah", name: "Sarah", accent: "American", gender: "Female" },
  { id: "af_sky", name: "Sky", accent: "American", gender: "Female" }
];

const cloudVoices: Voice[] = [
  { id: "en-IE-ConnorNeural", name: "Connor", accent: "Irish English", gender: "Male" },
  { id: "en-IE-EmilyNeural", name: "Emily", accent: "Irish English", gender: "Female" },
  { id: "en-IN-PrabhatNeural", name: "Prabhat", accent: "Indian English", gender: "Male" },
  { id: "en-IN-NeerjaNeural", name: "Neerja", accent: "Indian English", gender: "Female" },
  { id: "it-IT-GiuseppeMultilingualNeural", name: "Giuseppe", accent: "Italian English", gender: "Male" },
  { id: "it-IT-IsabellaNeural", name: "Isabella", accent: "Italian English", gender: "Female" },
  { id: "ru-RU-DmitryNeural", name: "Dmitry", accent: "Russian English", gender: "Male" },
  { id: "ru-RU-SvetlanaNeural", name: "Svetlana", accent: "Russian English", gender: "Female" }
];

const accentOptions: { value: AccentProfile; label: string }[] = [
  { value: "native", label: "Voice native accent" },
  { value: "american", label: "American" },
  { value: "british", label: "British" },
  { value: "scottish", label: "Scottish" },
  { value: "caribbean", label: "Caribbean" },
  { value: "new-york", label: "New York" },
  { value: "northern", label: "Northern England" },
  { value: "west-midlands", label: "West Midlands" },
  { value: "rp", label: "Received Pronunciation" }
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

const recordingBedCopy: Record<RecordingBed, string> = {
  none: "No background noise.",
  "receiver-hiss": "A quiet, continuous receiver hiss.",
  "vhf-static": "Steady airband static across voices and reply gaps.",
  "weak-signal": "Uneven static, light fading and occasional crackle.",
  "old-recorder": "Low tape noise, hum and small recording pops."
};

export default function DialogueMaker() {
  const [script, setScript] = useState(sampleScript);
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>("local");
  const [localAtcVoice, setLocalAtcVoice] = useState("bm_george");
  const [localPilotVoice, setLocalPilotVoice] = useState("am_michael");
  const [cloudAtcVoice, setCloudAtcVoice] = useState("en-IE-ConnorNeural");
  const [cloudPilotVoice, setCloudPilotVoice] = useState("en-IN-NeerjaNeural");
  const [atcAccent, setAtcAccent] = useState<AccentProfile>("native");
  const [pilotAccent, setPilotAccent] = useState<AccentProfile>("native");
  const [azureKey, setAzureKey] = useState("");
  const [azureRegion, setAzureRegion] = useState("westeurope");
  const [showAzureKey, setShowAzureKey] = useState(false);
  const [atcRate, setAtcRate] = useState(0);
  const [pilotRate, setPilotRate] = useState(0);
  const [pauseMs, setPauseMs] = useState(650);
  const [effect, setEffect] = useState<EffectName>("vhf");
  const [recordingBed, setRecordingBed] = useState<RecordingBed>("none");
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const voiceEngineRef = useRef<VoiceEngine>("local");
  const atcVoice = voiceEngine === "cloud" ? cloudAtcVoice : localAtcVoice;
  const pilotVoice = voiceEngine === "cloud" ? cloudPilotVoice : localPilotVoice;
  const availableVoices = voiceEngine === "cloud" ? cloudVoices : localVoices;

  const transmissionCount = useMemo(() => {
    return script.split(/\r?\n/).filter((line) => /^(atc|controller|tower|ground|approach|departure|pilot|aircraft|flight)\s*:/i.test(line.trim())).length;
  }, [script]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("atc-dialogue-maker.azure-speech") ?? "null") as { key?: string; region?: string } | null;
      if (saved?.key) setAzureKey(saved.key);
      if (saved?.region) setAzureRegion(saved.region);
      if (localStorage.getItem("atc-dialogue-maker.voice-engine") === "cloud") {
        voiceEngineRef.current = "cloud";
        setVoiceEngine("cloud");
      }
    } catch {
      // Invalid device-local settings are ignored.
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEngineStatus(({ message }) => {
      if (voiceEngineRef.current === "local") setStatus(message);
    });
    const startWarmup = () => {
      if (localStorage.getItem("atc-dialogue-maker.voice-engine") === "cloud") return;
      void warmVoiceEngine().catch(() => {
        // A button press will retry and surface any useful error.
      });
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(startWarmup, { timeout: 1500 });
      return () => {
        idleWindow.cancelIdleCallback?.(handle);
        unsubscribe();
      };
    }

    const handle = window.setTimeout(startWarmup, 700);
    return () => {
      window.clearTimeout(handle);
      unsubscribe();
    };
  }, []);

  function changeVoiceEngine(nextEngine: VoiceEngine) {
    voiceEngineRef.current = nextEngine;
    setVoiceEngine(nextEngine);
    localStorage.setItem("atc-dialogue-maker.voice-engine", nextEngine);
    setError("");
    setStatus(nextEngine === "cloud" ? "Cloud accents selected." : "Local voice engine selected.");
  }

  function updateAtcVoice(value: string) {
    if (voiceEngine === "cloud") setCloudAtcVoice(value);
    else setLocalAtcVoice(value);
  }

  function updatePilotVoice(value: string) {
    if (voiceEngine === "cloud") setCloudPilotVoice(value);
    else setLocalPilotVoice(value);
  }

  function saveCloudSettings() {
    if (!azureKey.trim() || !azureRegion.trim()) {
      setError("Enter both the Azure Speech key and region.");
      return;
    }
    localStorage.setItem("atc-dialogue-maker.azure-speech", JSON.stringify({ key: azureKey.trim(), region: azureRegion.trim() }));
    setError("");
    setStatus("Cloud engine settings saved on this device.");
  }

  function forgetCloudSettings() {
    localStorage.removeItem("atc-dialogue-maker.azure-speech");
    setAzureKey("");
    setStatus("Saved cloud settings removed.");
  }

  async function preview(role: Role) {
    setBusy(true);
    setError("");
    try {
      const previewText = role === "atc"
        ? "Balkan one two three, Sofia Tower, runway two seven, cleared for takeoff."
        : "Cleared for takeoff runway two seven, Balkan one two three.";
      const voice = role === "atc" ? atcVoice : pilotVoice;
      const speed = rateToSpeed(role === "atc" ? atcRate : pilotRate);
      if (voiceEngine === "cloud") setStatus("Generating preview · CLOUD");
      const generated = voiceEngine === "cloud"
        ? await makeCloudVoicePreview(previewText, voice, speed, azureKey, azureRegion)
        : await makeVoicePreview(previewText, voice, speed, role === "atc" ? atcAccent : pilotAccent);
      const filtered = await applyEffect(generated.samples, generated.sampleRate, effect);
      const withRecordingBed = applyRecordingBed(filtered, generated.sampleRate, recordingBed);
      const previewBlob = encodeWav(withRecordingBed, generated.sampleRate);
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

      const requests = dialogue.map((line) => ({
        text: line.text,
        voice: line.role === "atc" ? atcVoice : pilotVoice,
        speed: rateToSpeed(line.role === "atc" ? atcRate : pilotRate),
        accent: line.role === "atc" ? atcAccent : pilotAccent
      }));
      if (voiceEngine === "cloud") setStatus("Generating dialogue · CLOUD");
      const generated = voiceEngine === "cloud"
        ? await makeCloudDialogueAudio(
          requests.map(({ text, voice, speed }) => ({ text, voice, speed })),
          pauseMs,
          azureKey,
          azureRegion
        )
        : await makeDialogueAudio(requests, pauseMs);

      setStatus("Applying radio effect…");
      const filtered = await applyEffect(generated.samples, generated.sampleRate, effect);
      const mp3Blob = await makeMp3(filtered, generated.sampleRate, recordingBed);
      const nextUrl = URL.createObjectURL(mp3Blob);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(nextUrl);
      const bedLabel = recordingBed === "none" ? "" : ` · ${recordingBedLabel(recordingBed)}`;
      const engineLabel = voiceEngine === "cloud" ? "Cloud accents" : "Local voices";
      setResultLabel(`${dialogue.length} transmissions · ${engineLabel} · ${effectLabel(effect)}${bedLabel}`);
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

        <div className="field-block compact-field engine-picker">
          <label htmlFor="voice-engine">Voice engine</label>
          <select id="voice-engine" value={voiceEngine} onChange={(event) => changeVoiceEngine(event.target.value as VoiceEngine)}>
            <option value="local">Local voices · offline</option>
            <option value="cloud">Cloud accents · Irish, Indian, Italian, Russian</option>
          </select>
          <p>{voiceEngine === "cloud" ? "Real regional voices from Microsoft Speech." : "Fast browser voices with no account or key."}</p>
        </div>

        {voiceEngine === "cloud" && (
          <div className="cloud-settings">
            <div className="cloud-input">
              <label htmlFor="azure-key">Azure Speech key</label>
              <div className="key-input-row">
                <input
                  id="azure-key"
                  type={showAzureKey ? "text" : "password"}
                  value={azureKey}
                  onChange={(event) => setAzureKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Speech resource key"
                />
                <button type="button" onClick={() => setShowAzureKey((visible) => !visible)}>{showAzureKey ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div className="cloud-input">
              <label htmlFor="azure-region">Azure region</label>
              <input
                id="azure-region"
                type="text"
                value={azureRegion}
                onChange={(event) => setAzureRegion(event.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="westeurope"
              />
            </div>
            <div className="settings-actions">
              <button type="button" onClick={saveCloudSettings}>Save on this device</button>
              {azureKey && <button type="button" className="quiet" onClick={forgetCloudSettings}>Forget</button>}
            </div>
            <p>Stored only in this browser and sent directly to Microsoft Speech.</p>
          </div>
        )}

        <VoiceChoice
          number="1"
          role="Controller"
          color="blue"
          value={atcVoice}
          voices={availableVoices}
          showAccent={voiceEngine === "local"}
          accent={atcAccent}
          rate={atcRate}
          disabled={busy}
          onVoice={updateAtcVoice}
          onAccent={setAtcAccent}
          onRate={setAtcRate}
          onPreview={() => preview("atc")}
        />
        <VoiceChoice
          number="2"
          role="Pilot"
          color="orange"
          value={pilotVoice}
          voices={availableVoices}
          showAccent={voiceEngine === "local"}
          accent={pilotAccent}
          rate={pilotRate}
          disabled={busy}
          onVoice={updatePilotVoice}
          onAccent={setPilotAccent}
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

        <div className="field-block compact-field">
          <label htmlFor="effect">Radio effect</label>
          <select id="effect" value={effect} onChange={(event) => setEffect(event.target.value as EffectName)}>
            <option value="clean">Clean voice</option>
            <option value="light">Light radio</option>
            <option value="vhf">VHF radio</option>
            <option value="muffled">Muffled recording</option>
          </select>
          <p>{effectCopy[effect]}</p>
        </div>

        <div className="field-block compact-field last-field">
          <label htmlFor="recording-bed">Recording sound</label>
          <select id="recording-bed" value={recordingBed} onChange={(event) => setRecordingBed(event.target.value as RecordingBed)}>
            <option value="none">None</option>
            <option value="receiver-hiss">Light receiver hiss</option>
            <option value="vhf-static">VHF static bed</option>
            <option value="weak-signal">Weak signal</option>
            <option value="old-recorder">Old recorder</option>
          </select>
          <p>{recordingBedCopy[recordingBed]}</p>
        </div>
      </aside>

      <p className="local-note">{voiceEngine === "cloud" ? "Cloud voices · device-local key" : "Background voice engine · GPU when available"}</p>
    </main>
  );
}

function VoiceChoice({ number, role, color, value, voices, showAccent, accent, rate, disabled, onVoice, onAccent, onRate, onPreview }: {
  number: string;
  role: string;
  color: "blue" | "orange";
  value: string;
  voices: Voice[];
  showAccent: boolean;
  accent: AccentProfile;
  rate: number;
  disabled: boolean;
  onVoice: (value: string) => void;
  onAccent: (value: AccentProfile) => void;
  onRate: (value: number) => void;
  onPreview: () => void;
}) {
  const voiceGroups = Array.from(new Set(voices.map((voice) => voice.accent)));
  return (
    <div className="voice-choice">
      <div className="role-heading">
        <span className={color}>{number}</span>
        <div><b>{role}</b></div>
      </div>
      <div className="voice-select-row">
        <label className="sr-only" htmlFor={`${role}-voice`}>{role} voice</label>
        <select id={`${role}-voice`} value={value} onChange={(event) => onVoice(event.target.value)}>
          {voiceGroups.map((group) => (
            <optgroup key={group} label={group}>
              {voices.filter((voice) => voice.accent === group).map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" disabled={disabled} onClick={onPreview} aria-label={`Preview ${role.toLowerCase()} voice`}>▶</button>
      </div>
      {showAccent && (
        <div className="accent-select-row">
          <label htmlFor={`${role}-accent`}>English accent</label>
          <select id={`${role}-accent`} value={accent} onChange={(event) => onAccent(event.target.value as AccentProfile)}>
            {accentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
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

function writeText(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function effectLabel(effect: EffectName) {
  return { clean: "Clean voice", light: "Light radio", vhf: "VHF radio", muffled: "Muffled recording" }[effect];
}

function recordingBedLabel(bed: RecordingBed) {
  return {
    none: "No recording bed",
    "receiver-hiss": "Receiver hiss",
    "vhf-static": "VHF static bed",
    "weak-signal": "Weak signal",
    "old-recorder": "Old recorder"
  }[bed];
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while making the audio. Please try again.";
}
