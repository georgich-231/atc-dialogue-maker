"use client";

type IconProps = { className?: string };

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 3.4 12.4 8 5 12.6z" fill="currentColor" /></Icon>;
}

export function StopIcon(props: IconProps) {
  return <Icon {...props}><rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1" fill="currentColor" /></Icon>;
}

export function ChevronUpIcon(props: IconProps) {
  return <Icon {...props}><path d="m4 9.8 4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
}

export function ChevronDownIcon(props: IconProps) {
  return <Icon {...props}><path d="m4 6.2 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
}

export function CloseIcon(props: IconProps) {
  return <Icon {...props}><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>;
}

export function PlusIcon(props: IconProps) {
  return <Icon {...props}><path d="M8 3.6v8.8M3.6 8h8.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>;
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.6v7.2m0 0L5.2 7m2.8 2.8L10.8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11.6v1.2a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8v-1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Icon>
  );
}

/** House mark: a compass rose with a heading chevron. Drawn for this tool, not an official emblem. */
export function StudioMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" opacity=".45" />
      <circle cx="16" cy="16" r="8.4" stroke="currentColor" strokeWidth="1" opacity=".22" />
      <path d="M16 1.4v3.4M16 27.2v3.4M1.4 16h3.4M27.2 16h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
      <path d="M16 8.2 21.4 21 16 18.1 10.6 21z" fill="currentColor" />
    </svg>
  );
}
