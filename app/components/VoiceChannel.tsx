"use client";

import {
  accentOptions,
  engineName,
  roleChannel,
  roleLabel,
  voiceGroupLabel,
  type AccentProfile,
  type Role,
  type Voice
} from "../../src/dialogue";
import { PlayIcon, StopIcon } from "./icons";

type Props = {
  role: Role;
  voice: Voice;
  voices: Voice[];
  accent: AccentProfile;
  rate: number;
  disabled: boolean;
  previewing: boolean;
  onVoice: (id: string) => void;
  onAccent: (accent: AccentProfile) => void;
  onRate: (rate: number) => void;
  onPreview: () => void;
};

export function VoiceChannel({
  role, voice, voices, accent, rate, disabled, previewing,
  onVoice, onAccent, onRate, onPreview
}: Props) {
  const groups = Array.from(new Set(voices.map(voiceGroupLabel)));
  const voiceFieldId = `${role}-voice`;
  const accentFieldId = `${role}-accent`;
  const rateFieldId = `${role}-rate`;

  return (
    <div className={`channel channel-${role}`}>
      <div className="channel-head">
        <span className="channel-number">{roleChannel[role]}</span>
        <h3>{roleLabel[role]}</h3>
        <span className="channel-engine">{engineName(voice.engine)}</span>
      </div>

      <div className="channel-voice">
        <label className="sr-only" htmlFor={voiceFieldId}>{roleLabel[role]} voice</label>
        <select id={voiceFieldId} value={voice.id} onChange={(event) => onVoice(event.target.value)} disabled={disabled}>
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {voices.filter((item) => voiceGroupLabel(item) === group).map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {item.gender}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="icon-button accent large"
          onClick={onPreview}
          disabled={disabled}
          title={`Hear the ${roleLabel[role].toLowerCase()} voice`}
          aria-label={`Hear the ${roleLabel[role].toLowerCase()} voice`}
        >
          {previewing ? <StopIcon /> : <PlayIcon />}
        </button>
      </div>

      {voice.engine === "local" && (
        <div className="channel-row">
          <label htmlFor={accentFieldId}>Accent</label>
          <select id={accentFieldId} value={accent} onChange={(event) => onAccent(event.target.value as AccentProfile)} disabled={disabled}>
            {accentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}

      <div className="channel-rate">
        <label htmlFor={rateFieldId}>
          <span>Speech rate</span>
          <b>{rate > 0 ? "+" : ""}{rate}%</b>
        </label>
        <input
          id={rateFieldId}
          type="range"
          min="-30"
          max="30"
          step="5"
          value={rate}
          disabled={disabled}
          onChange={(event) => onRate(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
