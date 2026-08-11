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
import { makeElevenLabsVoice } from "../src/elevenlabs-speech";
import { applyRecordingBed, type RecordingBed } from "../src/recording-bed";

type Role = "atc" | "pilot";
type VoiceEngine = "local" | "azure" | "elevenlabs";
type EffectName = "clean" | "light" | "vhf" | "muffled";
type AccentProfile = "native" | "american" | "british" | "scottish" | "caribbean" | "new-york" | "northern" | "west-midlands" | "rp";
type DialogueLine = { role: Role; text: string };
type Voice = {
  id: string;
  serviceId: string;
  name: string;
  accent: string;
  gender: "Male" | "Female";
  engine: VoiceEngine;
  accentDirection?: string;
};

const localVoices: Voice[] = [
  ...[
    ["bm_george", "George", "British", "Male"], ["bm_fable", "Fable", "British", "Male"],
    ["bm_daniel", "Daniel", "British", "Male"], ["bm_lewis", "Lewis", "British", "Male"],
    ["am_michael", "Michael", "American", "Male"], ["am_fenrir", "Fenrir", "American", "Male"],
    ["am_puck", "Puck", "American", "Male"], ["am_eric", "Eric", "American", "Male"],
    ["am_onyx", "Onyx", "American", "Male"], ["am_liam", "Liam", "American", "Male"],
    ["am_adam", "Adam", "American", "Male"], ["am_echo", "Echo", "American", "Male"],
    ["am_santa", "Santa", "American", "Male"], ["bf_emma", "Emma", "British", "Female"],
    ["bf_isabella", "Isabella", "British", "Female"], ["bf_alice", "Alice", "British", "Female"],
    ["bf_lily", "Lily", "British", "Female"], ["af_heart", "Heart", "American", "Female"],
    ["af_bella", "Bella", "American", "Female"], ["af_alloy", "Alloy", "American", "Female"],
    ["af_aoede", "Aoede", "American", "Female"], ["af_jessica", "Jessica", "American", "Female"],
    ["af_kore", "Kore", "American", "Female"], ["af_nicole", "Nicole", "American", "Female"],
    ["af_nova", "Nova", "American", "Female"], ["af_river", "River", "American", "Female"],
    ["af_sarah", "Sarah", "American", "Female"], ["af_sky", "Sky", "American", "Female"]
  ].map(([id, name, accent, gender]) => ({
    id, serviceId: id, name, accent, gender: gender as "Male" | "Female", engine: "local" as const
  }))
];

const azureVoices: Voice[] = [
  ["en-IE-ConnorNeural", "Connor", "Irish English", "Male"],
  ["en-IE-EmilyNeural", "Emily", "Irish English", "Female"],
  ["en-IN-PrabhatNeural", "Prabhat", "Indian English", "Male"],
  ["en-IN-NeerjaNeural", "Neerja", "Indian English", "Female"],
  ["it-IT-GiuseppeMultilingualNeural", "Giuseppe", "Italian English", "Male"],
  ["it-IT-IsabellaNeural", "Isabella", "Italian English", "Female"],
  ["de-DE-ConradNeural", "Conrad", "German English", "Male"],
  ["de-DE-KatjaNeural", "Katja", "German English", "Female"],
  ["bg-BG-BorislavNeural", "Borislav", "Bulgarian English", "Male"],
  ["bg-BG-KalinaNeural", "Kalina", "Bulgarian English", "Female"]
].map(([id, name, accent, gender]) => ({
  id: `azure:${id}`, serviceId: id, name, accent, gender: gender as "Male" | "Female", engine: "azure" as const
}));

const elevenLabsVoices: Voice[] = [
  ["ru", "Russian", "Male", "JBFqnCBsd6RMkjVDRZzb", "[strong Russian accent]"],
  ["ru", "Russian", "Female", "21m00Tcm4TlvDq8ikWAM", "[strong Russian accent]"],
  ["de", "German", "Male", "JBFqnCBsd6RMkjVDRZzb", "[strong German accent]"],
  ["de", "German", "Female", "21m00Tcm4TlvDq8ikWAM", "[strong German accent]"],
  ["it", "Italian", "Male", "JBFqnCBsd6RMkjVDRZzb", "[strong Italian accent]"],
  ["it", "Italian", "Female", "21m00Tcm4TlvDq8ikWAM", "[strong Italian accent]"]
].map(([code, accent, gender, serviceId, accentDirection]) => ({
  id: `elevenlabs:${code}:${gender.toLowerCase()}`,
  serviceId,
  name: gender === "Male" ? "George" : "Rachel",
  accent: `Strong ${accent} English`,
  gender: gender as "Male" | "Female",
  engine: "elevenlabs" as const,
  accentDirection
}));

const allVoices = [...localVoices, ...azureVoices, ...elevenLabsVoices];

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
  const [atcVoiceId, setAtcVoiceId] = useState("bm_george");
  const [pilotVoiceId, setPilotVoiceId] = useState("am_michael");
  const [atcAccent, setAtcAccent] = useState<AccentProfile>("native");
  const [pilotAccent, setPilotAccent] = useState<AccentProfile>("native");
  const [azureKey, setAzureKey] = useState("");
  const [azureRegion, setAzureRegion] = useState("northeurope");
  const [showAzureKey, setShowAzureKey] = useState(false);
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
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
  const atcVoice = allVoices.find((voice) => voice.id === atcVoiceId) ?? localVoices[0];
  const pilotVoice = allVoices.find((voice) => voice.id === pilotVoiceId) ?? localVoices[4];

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
      const savedElevenLabsKey = localStorage.getItem("atc-dialogue-maker.elevenlabs-key");
      if (savedElevenLabsKey) setElevenLabsKey(savedElevenLabsKey);
      const pair = JSON.parse(localStorage.getItem("atc-dialogue-maker.voice-pair") ?? "null") as { atc?: string; pilot?: string } | null;
      if (pair?.atc && allVoices.some((voice) => voice.id === pair.atc)) setAtcVoiceId(pair.atc);
      if (pair?.pilot && allVoices.some((voice) => voice.id === pair.pilot)) setPilotVoiceId(pair.pilot);
    } catch {
      // Invalid device-local settings are ignored.
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEngineStatus(({ message }) => {
      setStatus(message);
    });
    const startWarmup = () => {
      try {
        const pair = JSON.parse(localStorage.getItem("atc-dialogue-maker.voice-pair") ?? "null") as { atc?: string; pilot?: string } | null;
        if (pair && ![pair.atc, pair.pilot].some((id) => localVoices.some((voice) => voice.id === id))) return;
      } catch {
        // Warm the default local voices if saved settings cannot be read.
      }
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

  function updateAtcVoice(value: string) {
    setAtcVoiceId(value);
    localStorage.setItem("atc-dialogue-maker.voice-pair", JSON.stringify({ atc: value, pilot: pilotVoiceId }));
    setError("");
  }

  function updatePilotVoice(value: string) {
    setPilotVoiceId(value);
    localStorage.setItem("atc-dialogue-maker.voice-pair", JSON.stringify({ atc: atcVoiceId, pilot: value }));
    setError("");
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

  function saveElevenLabsSettings() {
    if (!elevenLabsKey.trim()) {
      setError("Enter the ElevenLabs API key.");
      return;
    }
    localStorage.setItem("atc-dialogue-maker.elevenlabs-key", elevenLabsKey.trim());
    setError("");
    setStatus("ElevenLabs settings saved on this device.");
  }

  function forgetElevenLabsSettings() {
    localStorage.removeItem("atc-dialogue-maker.elevenlabs-key");
    setElevenLabsKey("");
    setStatus("Saved ElevenLabs settings removed.");
  }

  async function synthesizeVoiceLine(text: string, voice: Voice, speed: number, accent: AccentProfile) {
    if (voice.engine === "azure") {
      return makeCloudVoicePreview(text, voice.serviceId, speed, azureKey, azureRegion);
    }
    if (voice.engine === "elevenlabs") {
      return makeElevenLabsVoice(text, voice.serviceId, voice.accentDirection ?? "", speed, elevenLabsKey);
    }
    return makeVoicePreview(text, voice.serviceId, speed, accent);
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
      setStatus(`Generating preview · ${engineName(voice.engine)}`);
      const generated = await synthesizeVoiceLine(previewText, voice, speed, role === "atc" ? atcAccent : pilotAccent);
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
      if (atcVoice.id === pilotVoice.id) throw new Error("Choose two different voices so the speakers are easy to distinguish.");

      const requests = dialogue.map((line) => ({
        text: line.text,
        voice: line.role === "atc" ? atcVoice : pilotVoice,
        speed: rateToSpeed(line.role === "atc" ? atcRate : pilotRate),
        accent: line.role === "atc" ? atcAccent : pilotAccent
      }));
      const engines = new Set(requests.map(({ voice }) => voice.engine));
      if (engines.has("azure") && (!azureKey.trim() || !azureRegion.trim())) {
        throw new Error("Add the Azure Speech key and region under Voice service settings first.");
      }
      if (engines.has("elevenlabs") && !elevenLabsKey.trim()) {
        throw new Error("Add the ElevenLabs API key under Voice service settings first.");
      }
      let generated: { samples: Float32Array; sampleRate: number };
      if (engines.size === 1 && atcVoice.engine === "local") {
        generated = await makeDialogueAudio(
          requests.map(({ text, voice, speed, accent }) => ({ text, voice: voice.serviceId, speed, accent })),
          pauseMs
        );
      } else if (engines.size === 1 && atcVoice.engine === "azure") {
        setStatus("Generating dialogue · Azure");
        generated = await makeCloudDialogueAudio(
          requests.map(({ text, voice, speed }) => ({ text, voice: voice.serviceId, speed })),
          pauseMs,
          azureKey,
          azureRegion
        );
      } else {
        const clips: { samples: Float32Array; sampleRate: number }[] = [];
        for (let index = 0; index < requests.length; index += 1) {
          const request = requests[index];
          setStatus(`Generating transmission ${index + 1} of ${requests.length} · ${engineName(request.voice.engine)}`);
          clips.push(await synthesizeVoiceLine(request.text, request.voice, request.speed, request.accent));
        }
        generated = joinAudioClips(clips, pauseMs);
      }

      setStatus("Applying radio effect…");
      const filtered = await applyEffect(generated.samples, generated.sampleRate, effect);
      const mp3Blob = await makeMp3(filtered, generated.sampleRate, recordingBed);
      const nextUrl = URL.createObjectURL(mp3Blob);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(nextUrl);
      const bedLabel = recordingBed === "none" ? "" : ` · ${recordingBedLabel(recordingBed)}`;
      const engineLabel = engines.size > 1 ? "Mixed voices" : engineName(atcVoice.engine);
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

        <div className="field-block compact-field voice-library-note">
          <label>Voice library</label>
          <p>Local, Azure and ElevenLabs voices are together below. Choose any source for each speaker.</p>
        </div>

        <div className="service-settings">
          <details>
            <summary><span>Azure Speech</span><b>{azureKey ? "Ready" : "Key needed"}</b></summary>
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
                placeholder="northeurope"
              />
            </div>
            <div className="settings-actions">
              <button type="button" onClick={saveCloudSettings}>Save on this device</button>
              {azureKey && <button type="button" className="quiet" onClick={forgetCloudSettings}>Forget</button>}
            </div>
            <p>Stored only in this browser and sent directly to Microsoft Speech.</p>
            </div>
          </details>

          <details>
            <summary><span>ElevenLabs accents</span><b>{elevenLabsKey ? "Ready" : "Key needed"}</b></summary>
            <div className="cloud-settings elevenlabs-settings">
              <div className="cloud-input">
                <label htmlFor="elevenlabs-key">ElevenLabs API key</label>
                <div className="key-input-row">
                  <input
                    id="elevenlabs-key"
                    type={showElevenLabsKey ? "text" : "password"}
                    value={elevenLabsKey}
                    onChange={(event) => setElevenLabsKey(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Restricted text-to-speech key"
                  />
                  <button type="button" onClick={() => setShowElevenLabsKey((visible) => !visible)}>{showElevenLabsKey ? "Hide" : "Show"}</button>
                </div>
              </div>
              <div className="settings-actions">
                <button type="button" onClick={saveElevenLabsSettings}>Save on this device</button>
                {elevenLabsKey && <button type="button" className="quiet" onClick={forgetElevenLabsSettings}>Forget</button>}
              </div>
              <p>Use a TTS-only restricted key with a credit limit. It stays in this browser and is sent directly to ElevenLabs.</p>
            </div>
          </details>
        </div>

        <VoiceChoice
          number="1"
          role="Controller"
          color="blue"
          value={atcVoice.id}
          voices={allVoices}
          showAccent={atcVoice.engine === "local"}
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
          value={pilotVoice.id}
          voices={allVoices}
          showAccent={pilotVoice.engine === "local"}
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

      <p className="local-note">Local, Azure &amp; ElevenLabs voices · mix any two</p>
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
  const voiceGroups = Array.from(new Set(voices.map(voiceGroupLabel)));
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
              {voices.filter((voice) => voiceGroupLabel(voice) === group).map((voice) => (
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

function engineName(engine: VoiceEngine) {
  return { local: "Local", azure: "Azure", elevenlabs: "ElevenLabs" }[engine];
}

function voiceGroupLabel(voice: Voice) {
  return `${engineName(voice.engine)} · ${voice.accent}`;
}

function joinAudioClips(clips: { samples: Float32Array; sampleRate: number }[], pauseMs: number) {
  const sampleRate = 24_000;
  const normalized = clips.map((clip) => resampleAudio(clip.samples, clip.sampleRate, sampleRate));
  const gapLength = Math.round(sampleRate * Math.max(0, pauseMs) / 1000);
  const totalLength = normalized.reduce((total, samples) => total + samples.length, 0) + gapLength * Math.max(0, normalized.length - 1);
  const joined = new Float32Array(totalLength);
  let offset = 0;
  normalized.forEach((samples, index) => {
    joined.set(samples, offset);
    offset += samples.length;
    if (index < normalized.length - 1) offset += gapLength;
  });
  return { samples: joined, sampleRate };
}

function resampleAudio(samples: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return samples;
  const length = Math.max(1, Math.round(samples.length * toRate / fromRate));
  const output = new Float32Array(length);
  const ratio = fromRate / toRate;
  for (let index = 0; index < length; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourcePosition - left;
    output[index] = samples[left] * (1 - fraction) + samples[right] * fraction;
  }
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
