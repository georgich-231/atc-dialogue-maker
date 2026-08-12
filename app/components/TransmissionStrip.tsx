"use client";

import { useEffect, useRef } from "react";
import {
  countWords,
  engineName,
  roleChannel,
  roleLabel,
  roleTag,
  type Transmission,
  type Voice
} from "../../src/dialogue";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, PlayIcon, StopIcon } from "./icons";

type Props = {
  transmission: Transmission;
  index: number;
  total: number;
  voice: Voice;
  disabled: boolean;
  previewing: boolean;
  focused: boolean;
  onText: (text: string) => void;
  onToggleRole: () => void;
  onPreview: () => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  onFocusHandled: () => void;
};

export function TransmissionStrip({
  transmission, index, total, voice, disabled, previewing, focused,
  onText, onToggleRole, onPreview, onMove, onRemove, onAddAfter, onFocusHandled
}: Props) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  const words = countWords(transmission.text);

  useEffect(() => {
    if (!focused) return;
    const element = field.current;
    if (element) {
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }
    onFocusHandled();
  }, [focused, onFocusHandled]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onAddAfter();
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onMove(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (event.key === "Backspace" && !transmission.text && total > 1) {
      event.preventDefault();
      onRemove();
    }
  }

  return (
    <article className={`strip strip-${transmission.role}${previewing ? " is-previewing" : ""}`}>
      <div className="strip-gutter">
        <span className="strip-seq">{String(index + 1).padStart(2, "0")}</span>
        <button
          type="button"
          className="strip-role"
          onClick={onToggleRole}
          disabled={disabled}
          title={`Speaking: ${roleLabel[transmission.role]}. Switch to the other speaker.`}
        >
          {roleTag[transmission.role]}
        </button>
      </div>

      <div className="strip-body">
        <div className="grow-wrap" data-value={transmission.text}>
          <textarea
            ref={field}
            className="strip-text"
            value={transmission.text}
            rows={1}
            spellCheck
            aria-label={`Transmission ${index + 1}, ${roleLabel[transmission.role]}`}
            placeholder={transmission.role === "atc" ? "Controller transmission…" : "Pilot reply…"}
            onChange={(event) => onText(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="strip-meta">
          <span className="strip-voice">
            {roleChannel[transmission.role]} · {voice.name}
            <em>{engineName(voice.engine)}</em>
          </span>
          <span className="strip-count">{words} {words === 1 ? "word" : "words"}</span>
        </div>
      </div>

      <div className="strip-actions">
        <button
          type="button"
          className="icon-button accent"
          onClick={onPreview}
          disabled={disabled || !transmission.text.trim()}
          title="Listen to this transmission"
          aria-label={`Listen to transmission ${index + 1}`}
        >
          {previewing ? <StopIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMove(-1)}
          disabled={disabled || index === 0}
          title="Move up (Alt + Up)"
          aria-label={`Move transmission ${index + 1} up`}
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMove(1)}
          disabled={disabled || index === total - 1}
          title="Move down (Alt + Down)"
          aria-label={`Move transmission ${index + 1} down`}
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="icon-button danger"
          onClick={onRemove}
          disabled={disabled || total === 1}
          title="Delete transmission"
          aria-label={`Delete transmission ${index + 1}`}
        >
          <CloseIcon />
        </button>
      </div>
    </article>
  );
}
