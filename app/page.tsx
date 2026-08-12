"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  makeDialogueAudio,
  makeMp3,
  makeVoicePreview,
  subscribeToEngineStatus,
  warmVoiceEngine
} from "../src/audio-worker-client";
import { makeCloudDialogueAudio, makeCloudVoicePreview } from "../src/azure-speech";
import { applyRecordingBed, type RecordingBed } from "../src/recording-bed";
import { applyEffect, encodeWav, joinAudioClips } from "../src/audio-mix";
import {
  allVoices,
  bedOptions,
  effectOptions,
  engineName,
  estimateSeconds,
  fileSlug,
  findVoice,
  formatClock,
  gapOptions,
  localVoices,
  maxCharacters,
  maxTransmissions,
  newTransmission,
  oppositeRole,
  parseScriptText,
  rateToSpeed,
  readableError,
  sampleTransmissions,
  serializeTransmissions,
  type AccentProfile,
  type EffectName,
  type Role,
  type Transmission,
  type Voice
} from "../src/dialogue";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  themeStorageKey,
  type ThemePreference
} from "../src/theme";
import { TransmissionStrip } from "./components/TransmissionStrip";
import { VoiceChannel } from "./components/VoiceChannel";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { DownloadIcon, PlusIcon, StudioMark } from "./components/icons";

type EditorMode = "strips" | "text";
type SavedDraft = {
  title?: string;
  transmissions?: { role?: Role; text?: string }[];
  atcVoiceId?: string;
  pilotVoiceId?: string;
  atcAccent?: AccentProfile;
  pilotAccent?: AccentProfile;
  atcRate?: number;
  pilotRate?: number;
  pauseMs?: number;
  effect?: EffectName;
  recordingBed?: RecordingBed;
};

const draftKey = "atc-dialogue-studio.draft";
const azureKeyName = "atc-dialogue-maker.azure-speech";
const legacyVoicePairKey = "atc-dialogue-maker.voice-pair";

export default function DialogueStudio() {
  const [title, setTitle] = useState("Sofia Tower · departure");
  const [transmissions, setTransmissions] = useState<Transmission[]>(sampleTransmissions);
  const [mode, setMode] = useState<EditorMode>("strips");
  const [scriptText, setScriptText] = useState("");
  const [scriptNote, setScriptNote] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const [atcVoiceId, setAtcVoiceId] = useState("bm_george");
  const [pilotVoiceId, setPilotVoiceId] = useState("am_michael");
  const [atcAccent, setAtcAccent] = useState<AccentProfile>("native");
  const [pilotAccent, setPilotAccent] = useState<AccentProfile>("native");
  const [atcRate, setAtcRate] = useState(0);
  const [pilotRate, setPilotRate] = useState(0);
  const [pauseMs, setPauseMs] = useState(650);
  const [effect, setEffect] = useState<EffectName>("vhf");
  const [recordingBed, setRecordingBed] = useState<RecordingBed>("none");

  const [azureKey, setAzureKey] = useState("");
  const [azureRegion, setAzureRegion] = useState("northeurope");
  const [showAzureKey, setShowAzureKey] = useState(false);

  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [engineKind, setEngineKind] = useState<"gpu" | "cpu" | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");

  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const previewUrl = useRef("");

  const atcVoice = findVoice(atcVoiceId, localVoices[0]);
  const pilotVoice = findVoice(pilotVoiceId, localVoices[4]);
  const voiceFor = useCallback(
    (role: Role) => (role === "atc" ? atcVoice : pilotVoice),
    [atcVoice, pilotVoice]
  );
  const speedFor = useCallback(
    (role: Role) => rateToSpeed(role === "atc" ? atcRate : pilotRate),
    [atcRate, pilotRate]
  );

  const spokenCount = useMemo(
    () => transmissions.filter((transmission) => transmission.text.trim()).length,
    [transmissions]
  );
  const estimate = useMemo(
    () => estimateSeconds(transmissions, pauseMs, speedFor),
    [transmissions, pauseMs, speedFor]
  );
  const usesAzure = atcVoice.engine === "azure" || pilotVoice.engine === "azure";
  const cloudReady = Boolean(azureKey.trim() && azureRegion.trim());

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(azureKeyName) ?? "null") as { key?: string; region?: string } | null;
      if (saved?.key) setAzureKey(saved.key);
      if (saved?.region) setAzureRegion(saved.region);
      localStorage.removeItem("atc-dialogue-maker.elevenlabs-key");
      localStorage.removeItem("atc-dialogue-maker.elevenlabs-voices");

      const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as SavedDraft | null;
      if (draft) {
        if (typeof draft.title === "string") setTitle(draft.title);
        if (Array.isArray(draft.transmissions) && draft.transmissions.length) {
          setTransmissions(draft.transmissions
            .slice(0, maxTransmissions)
            .map((line) => newTransmission(line.role === "pilot" ? "pilot" : "atc", String(line.text ?? ""))));
        }
        if (draft.atcVoiceId && allVoices.some((voice) => voice.id === draft.atcVoiceId)) setAtcVoiceId(draft.atcVoiceId);
        if (draft.pilotVoiceId && allVoices.some((voice) => voice.id === draft.pilotVoiceId)) setPilotVoiceId(draft.pilotVoiceId);
        if (draft.atcAccent) setAtcAccent(draft.atcAccent);
        if (draft.pilotAccent) setPilotAccent(draft.pilotAccent);
        if (typeof draft.atcRate === "number") setAtcRate(draft.atcRate);
        if (typeof draft.pilotRate === "number") setPilotRate(draft.pilotRate);
        if (typeof draft.pauseMs === "number") setPauseMs(draft.pauseMs);
        if (draft.effect) setEffect(draft.effect);
        if (draft.recordingBed) setRecordingBed(draft.recordingBed);
      } else {
        const pair = JSON.parse(localStorage.getItem(legacyVoicePairKey) ?? "null") as { atc?: string; pilot?: string } | null;
        if (pair?.atc && allVoices.some((voice) => voice.id === pair.atc)) setAtcVoiceId(pair.atc);
        if (pair?.pilot && allVoices.some((voice) => voice.id === pair.pilot)) setPilotVoiceId(pair.pilot);
      }
    } catch {
      // Invalid device-local settings are ignored.
    }
    setTheme(readStoredPreference());
    setHydrated(true);
  }, []);

  /* The boot script in the page head has already applied the stored theme, so
     this only has to keep it in step with the switch and the system setting. */
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(resolveTheme(theme));
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The theme simply will not be remembered on the next visit.
    }
    if (theme !== "system" || typeof window.matchMedia !== "function") return;

    /* The media query is the live signal; the visibility check catches a system
       theme that changed while this tab sat in the background. */
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => applyTheme(resolveTheme("system"));
    const resyncWhenVisible = () => {
      if (document.visibilityState === "visible") followSystem();
    };
    query.addEventListener("change", followSystem);
    document.addEventListener("visibilitychange", resyncWhenVisible);
    return () => {
      query.removeEventListener("change", followSystem);
      document.removeEventListener("visibilitychange", resyncWhenVisible);
    };
  }, [hydrated, theme]);

  useEffect(() => {
    if (!hydrated) return;
    const draft: SavedDraft = {
      title,
      transmissions: transmissions.map(({ role, text }) => ({ role, text })),
      atcVoiceId, pilotVoiceId, atcAccent, pilotAccent, atcRate, pilotRate, pauseMs, effect, recordingBed
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // A full or blocked storage quota must never interrupt the work.
    }
  }, [hydrated, title, transmissions, atcVoiceId, pilotVoiceId, atcAccent, pilotAccent, atcRate, pilotRate, pauseMs, effect, recordingBed]);

  useEffect(() => {
    const unsubscribe = subscribeToEngineStatus(({ message, engine }) => {
      setStatus(message);
      if (engine) setEngineKind(engine);
    });

    const startWarmup = () => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as SavedDraft | null;
        const saved = [draft?.atcVoiceId, draft?.pilotVoiceId].filter(Boolean) as string[];
        if (saved.length && !saved.some((id) => localVoices.some((voice) => voice.id === id))) return;
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

  const handleFocusHandled = useCallback(() => setFocusId(null), []);

  function updateTransmission(id: string, text: string) {
    setTransmissions((current) => current.map((item) => (item.id === id ? { ...item, text } : item)));
  }

  function toggleRole(id: string) {
    setTransmissions((current) => current.map((item) => (
      item.id === id ? { ...item, role: oppositeRole(item.role) } : item
    )));
  }

  function moveTransmission(id: string, offset: number) {
    setTransmissions((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeTransmission(id: string) {
    if (transmissions.length === 1) return;
    const index = transmissions.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = transmissions.filter((item) => item.id !== id);
    setTransmissions(next);
    setFocusId(next[Math.max(0, index - 1)]?.id ?? null);
  }

  function addAfter(id: string) {
    const index = transmissions.findIndex((item) => item.id === id);
    if (index < 0) return;
    if (transmissions.length >= maxTransmissions) {
      setError(`Keep the exercise to ${maxTransmissions} transmissions or fewer.`);
      return;
    }
    const added = newTransmission(oppositeRole(transmissions[index].role));
    setTransmissions([...transmissions.slice(0, index + 1), added, ...transmissions.slice(index + 1)]);
    setFocusId(added.id);
  }

  function addAtEnd(role: Role) {
    if (transmissions.length >= maxTransmissions) {
      setError(`Keep the exercise to ${maxTransmissions} transmissions or fewer.`);
      return;
    }
    const added = newTransmission(role);
    setTransmissions([...transmissions, added]);
    setFocusId(added.id);
  }

  function loadExample() {
    setTransmissions(sampleTransmissions());
    setTitle("Sofia Tower · departure");
    setError("");
    setScriptNote("");
  }

  function clearAll() {
    setTransmissions([newTransmission("atc")]);
    setError("");
    setScriptNote("");
  }

  function changeMode(next: EditorMode) {
    if (next === mode) return;
    if (next === "text") setScriptText(serializeTransmissions(transmissions));
    setScriptNote("");
    setMode(next);
  }

  function editScriptText(value: string) {
    setScriptText(value);
    try {
      const parsed = parseScriptText(value);
      if (parsed.length > maxTransmissions) {
        setScriptNote(`Only the first ${maxTransmissions} transmissions will be kept.`);
      } else {
        setScriptNote("");
      }
      setTransmissions(parsed.length ? parsed.slice(0, maxTransmissions) : [newTransmission("atc")]);
    } catch (parseError) {
      setScriptNote(readableError(parseError));
    }
  }

  function saveCloudSettings() {
    if (!azureKey.trim() || !azureRegion.trim()) {
      setError("Enter both the Azure Speech key and region.");
      return;
    }
    localStorage.setItem(azureKeyName, JSON.stringify({ key: azureKey.trim(), region: azureRegion.trim() }));
    setError("");
    setStatus("Cloud engine settings saved on this device.");
  }

  function forgetCloudSettings() {
    localStorage.removeItem(azureKeyName);
    setAzureKey("");
    setStatus("Saved cloud settings removed.");
  }

  function stopPreview() {
    previewAudio.current?.pause();
    previewAudio.current = null;
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = "";
    }
    setPreviewKey(null);
  }

  async function synthesize(text: string, voice: Voice, speed: number, accent: AccentProfile) {
    if (voice.engine === "azure") {
      return makeCloudVoicePreview(text, voice.serviceId, speed, azureKey, azureRegion);
    }
    return makeVoicePreview(text, voice.serviceId, speed, accent);
  }

  async function runPreview(key: string, text: string, role: Role) {
    if (previewKey === key) {
      stopPreview();
      setStatus("Preview stopped.");
      return;
    }
    stopPreview();
    setBusy(true);
    setError("");
    try {
      const voice = voiceFor(role);
      const accent = role === "atc" ? atcAccent : pilotAccent;
      setStatus(`Generating preview · ${engineName(voice.engine)} · ${voice.name}`);
      const generated = await synthesize(text, voice, speedFor(role), accent);
      const filtered = await applyEffect(generated.samples, generated.sampleRate, effect);
      const withBed = applyRecordingBed(filtered, generated.sampleRate, recordingBed);
      const url = URL.createObjectURL(encodeWav(withBed, generated.sampleRate));

      const audio = new Audio(url);
      audio.addEventListener("ended", () => {
        setPreviewKey((current) => (current === key ? null : current));
        if (previewUrl.current === url) {
          URL.revokeObjectURL(url);
          previewUrl.current = "";
        }
      });
      previewAudio.current = audio;
      previewUrl.current = url;
      setPreviewKey(key);
      await audio.play();
      setStatus("Playing preview.");
    } catch (previewError) {
      stopPreview();
      setError(readableError(previewError));
      setStatus("The preview could not be made.");
    } finally {
      setBusy(false);
    }
  }

  function previewChannel(role: Role) {
    const text = role === "atc"
      ? "Balkan one two three, Sofia Tower, runway two seven, cleared for takeoff."
      : "Cleared for takeoff runway two seven, Balkan one two three.";
    void runPreview(`channel:${role}`, text, role);
  }

  async function generateDialogue() {
    stopPreview();
    setBusy(true);
    setError("");
    try {
      const dialogue = transmissions.filter((transmission) => transmission.text.trim());
      if (!dialogue.length) throw new Error("Write at least one transmission before building the recording.");
      if (dialogue.length > maxTransmissions) throw new Error(`Keep the exercise to ${maxTransmissions} transmissions or fewer.`);
      const characters = dialogue.reduce((total, transmission) => total + transmission.text.length, 0);
      if (characters > maxCharacters) throw new Error(`Keep the exercise under ${maxCharacters.toLocaleString("en-GB")} characters.`);

      const roles = new Set(dialogue.map((transmission) => transmission.role));
      if (roles.size > 1 && atcVoice.id === pilotVoice.id) {
        throw new Error("Choose two different voices so the controller and the pilot can be told apart.");
      }

      const requests = dialogue.map((transmission) => ({
        text: transmission.text.trim(),
        voice: voiceFor(transmission.role),
        speed: speedFor(transmission.role),
        accent: transmission.role === "atc" ? atcAccent : pilotAccent
      }));
      const engines = new Set(requests.map(({ voice }) => voice.engine));
      if (engines.has("azure") && !cloudReady) {
        throw new Error("Add the Azure Speech key and region under Cloud engine first.");
      }

      let generated: { samples: Float32Array; sampleRate: number };
      if (engines.size === 1 && engines.has("local")) {
        generated = await makeDialogueAudio(
          requests.map(({ text, voice, speed, accent }) => ({ text, voice: voice.serviceId, speed, accent })),
          pauseMs
        );
      } else if (engines.size === 1 && engines.has("azure")) {
        setStatus("Generating dialogue · Azure");
        generated = await makeCloudDialogueAudio(
          requests.map(({ text, voice, speed }) => ({ text, voice: voice.serviceId, speed })),
          pauseMs,
          azureKey,
          azureRegion
        );
      } else {
        const clips: { samples: Float32Array; sampleRate: number }[] = [];
        for (const [index, request] of requests.entries()) {
          setStatus(`Generating transmission ${index + 1} of ${requests.length} · ${engineName(request.voice.engine)}`);
          clips.push(await synthesize(request.text, request.voice, request.speed, request.accent));
        }
        generated = joinAudioClips(clips, pauseMs);
      }

      setStatus("Applying the radio effect…");
      const filtered = await applyEffect(generated.samples, generated.sampleRate, effect);
      const mp3Blob = await makeMp3(filtered, generated.sampleRate, recordingBed);
      const nextUrl = URL.createObjectURL(mp3Blob);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(nextUrl);

      const duration = formatClock(generated.samples.length / generated.sampleRate);
      const engineLabel = engines.size > 1 ? "Mixed engines" : engineName(requests[0].voice.engine);
      const bedLabel = recordingBed === "none" ? "" : ` · ${labelOf(bedOptions, recordingBed)}`;
      setResultLabel(`${dialogue.length} transmissions · ${duration} · ${engineLabel} · ${labelOf(effectOptions, effect)}${bedLabel}`);
      setStatus("Recording ready.");
    } catch (generationError) {
      setError(readableError(generationError));
      setStatus("The recording was not built.");
    } finally {
      setBusy(false);
    }
  }

  const buildShortcut = useRef(() => {});
  buildShortcut.current = () => {
    if (!busy) void generateDialogue();
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        buildShortcut.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <StudioMark className="brand-mark" />
          <div className="brand-text">
            <p className="brand-org">BULATSA · Internal training tool</p>
            <h1>ATC Dialogue Studio</h1>
          </div>
        </div>
        <div className="topbar-chips">
          <span className={`chip${engineKind ? " chip-live" : ""}`}>
            <i aria-hidden="true" />
            Local engine
            <b>{engineKind === "gpu" ? "GPU" : engineKind === "cpu" ? "CPU" : "Standby"}</b>
          </span>
          <span className={`chip${cloudReady ? " chip-live" : usesAzure ? " chip-warn" : ""}`}>
            <i aria-hidden="true" />
            Cloud voices
            <b>{cloudReady ? "Linked" : "Key needed"}</b>
          </span>
          <ThemeSwitch value={theme} onChange={setTheme} />
        </div>
      </header>

      <main className="workspace">
        <section className="panel dialogue-panel">
          <div className="panel-head">
            <div className="exercise-title">
              <label htmlFor="exercise-title">Exercise</label>
              <input
                id="exercise-title"
                type="text"
                value={title}
                maxLength={80}
                placeholder="Untitled exercise"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="panel-tools">
              <div className="mode-switch" role="tablist" aria-label="Editor mode">
                <button type="button" role="tab" aria-selected={mode === "strips"} className={mode === "strips" ? "is-active" : ""} onClick={() => changeMode("strips")}>Strips</button>
                <button type="button" role="tab" aria-selected={mode === "text"} className={mode === "text" ? "is-active" : ""} onClick={() => changeMode("text")}>Script text</button>
              </div>
              <button type="button" className="ghost-button" onClick={loadExample}>Example</button>
              <button type="button" className="ghost-button" onClick={clearAll}>Clear</button>
            </div>
          </div>

          {mode === "strips" ? (
            <>
              <div className="strip-list">
                {transmissions.map((transmission, index) => (
                  <TransmissionStrip
                    key={transmission.id}
                    transmission={transmission}
                    index={index}
                    total={transmissions.length}
                    voice={voiceFor(transmission.role)}
                    disabled={busy}
                    previewing={previewKey === `strip:${transmission.id}`}
                    focused={focusId === transmission.id}
                    onText={(text) => updateTransmission(transmission.id, text)}
                    onToggleRole={() => toggleRole(transmission.id)}
                    onPreview={() => void runPreview(`strip:${transmission.id}`, transmission.text.trim(), transmission.role)}
                    onMove={(offset) => moveTransmission(transmission.id, offset)}
                    onRemove={() => removeTransmission(transmission.id)}
                    onAddAfter={() => addAfter(transmission.id)}
                    onFocusHandled={handleFocusHandled}
                  />
                ))}
              </div>
              <div className="strip-add">
                <button type="button" className="add-button add-atc" onClick={() => addAtEnd("atc")}>
                  <PlusIcon /> Controller
                </button>
                <button type="button" className="add-button add-pilot" onClick={() => addAtEnd("pilot")}>
                  <PlusIcon /> Pilot
                </button>
                <p className="hint">
                  <kbd>Enter</kbd> adds the reply · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>Alt</kbd>+<kbd>↑</kbd><kbd>↓</kbd> reorder
                </p>
              </div>
            </>
          ) : (
            <div className="script-mode">
              <textarea
                className="script-text"
                value={scriptText}
                spellCheck
                aria-label="Dialogue script"
                placeholder={"ATC: Controller transmission\n\nPILOT: Pilot response"}
                onChange={(event) => editScriptText(event.target.value)}
              />
              <p className={`script-note${scriptNote ? " is-warning" : ""}`}>
                {scriptNote || "Start each transmission with ATC: or PILOT:. CONTROLLER, TOWER, GROUND, APPROACH and DEPARTURE also count as the controller; AIRCRAFT and FLIGHT count as the pilot."}
              </p>
            </div>
          )}
        </section>

        <aside className="rail">
          <section className="panel rail-panel">
            <h2 className="rail-title">Voice channels</h2>
            <VoiceChannel
              role="atc"
              voice={atcVoice}
              voices={allVoices}
              accent={atcAccent}
              rate={atcRate}
              disabled={busy}
              previewing={previewKey === "channel:atc"}
              onVoice={(id) => { setAtcVoiceId(id); setError(""); }}
              onAccent={setAtcAccent}
              onRate={setAtcRate}
              onPreview={() => previewChannel("atc")}
            />
            <VoiceChannel
              role="pilot"
              voice={pilotVoice}
              voices={allVoices}
              accent={pilotAccent}
              rate={pilotRate}
              disabled={busy}
              previewing={previewKey === "channel:pilot"}
              onVoice={(id) => { setPilotVoiceId(id); setError(""); }}
              onAccent={setPilotAccent}
              onRate={setPilotRate}
              onPreview={() => previewChannel("pilot")}
            />
          </section>

          <section className="panel rail-panel">
            <h2 className="rail-title">Radio character</h2>
            <div className="rail-field">
              <label htmlFor="effect">Transmission filter</label>
              <select id="effect" value={effect} onChange={(event) => setEffect(event.target.value as EffectName)} disabled={busy}>
                {effectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p>{detailOf(effectOptions, effect)}</p>
            </div>
            <div className="rail-field">
              <label htmlFor="recording-bed">Background sound</label>
              <select id="recording-bed" value={recordingBed} onChange={(event) => setRecordingBed(event.target.value as RecordingBed)} disabled={busy}>
                {bedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p>{detailOf(bedOptions, recordingBed)}</p>
            </div>
            <div className="rail-field">
              <label htmlFor="pause">Gap between transmissions</label>
              <select id="pause" value={pauseMs} onChange={(event) => setPauseMs(Number(event.target.value))} disabled={busy}>
                {gapOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </section>

          <section className="panel rail-panel">
            <h2 className="rail-title">Cloud engine</h2>
            <details className="cloud" open={usesAzure && !cloudReady}>
              <summary>
                <span>Azure Speech</span>
                <b className={cloudReady ? "ok" : "todo"}>{cloudReady ? "Linked" : "Key needed"}</b>
              </summary>
              <div className="cloud-body">
                <div className="rail-field">
                  <label htmlFor="azure-key">Speech resource key</label>
                  <div className="key-row">
                    <input
                      id="azure-key"
                      type={showAzureKey ? "text" : "password"}
                      value={azureKey}
                      onChange={(event) => setAzureKey(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Paste the key"
                    />
                    <button type="button" className="ghost-button" onClick={() => setShowAzureKey((visible) => !visible)}>
                      {showAzureKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="rail-field">
                  <label htmlFor="azure-region">Region</label>
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
                <div className="cloud-actions">
                  <button type="button" className="ghost-button strong" onClick={saveCloudSettings}>Save on this device</button>
                  {azureKey && <button type="button" className="ghost-button" onClick={forgetCloudSettings}>Forget</button>}
                </div>
                <p className="fine-print">Stored only in this browser and sent directly to Microsoft Speech. Local voices need no key.</p>
              </div>
            </details>
          </section>
        </aside>
      </main>

      <footer className="output-bar">
        <div className="output-status" aria-live="polite">
          <span className={`state-dot${busy ? " is-busy" : ""}${error ? " is-error" : ""}`} aria-hidden="true" />
          <p className={error ? "is-error" : ""}>{error || status}</p>
        </div>

        <div className="output-meta">
          <span><b>{spokenCount}</b> transmission{spokenCount === 1 ? "" : "s"}</span>
          <span>≈ <b>{formatClock(estimate)}</b></span>
          <span>{labelOf(effectOptions, effect)}</span>
        </div>

        {resultUrl && (
          <div className="output-result">
            <audio controls src={resultUrl} aria-label="Generated dialogue" />
            <a className="save-link" href={resultUrl} download={`${fileSlug(title)}.mp3`}>
              <DownloadIcon /> Save MP3
            </a>
            <span className="result-label">{resultLabel}</span>
          </div>
        )}

        <button type="button" className="build-button" disabled={busy} onClick={generateDialogue}>
          {busy ? "Working…" : "Build recording"}
          <small>MP3</small>
        </button>
      </footer>
    </div>
  );
}

function labelOf<T extends string | number>(options: { value: T; label: string }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

function detailOf<T extends string>(options: { value: T; detail: string }[], value: T) {
  return options.find((option) => option.value === value)?.detail ?? "";
}
