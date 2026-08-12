"use client";

import { themeOptions, type ThemePreference } from "../../src/theme";
import { AutoThemeIcon, MoonIcon, SunIcon } from "./icons";

const icons = {
  system: AutoThemeIcon,
  light: SunIcon,
  dark: MoonIcon
} as const;

export function ThemeSwitch({ value, onChange }: {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Theme">
      {themeOptions.map((option) => {
        const Icon = icons[option.value];
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.title}
            className={value === option.value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
