export type Role = "atc" | "pilot";
export type VoiceEngine = "local" | "azure";
export type EffectName = "clean" | "light" | "vhf" | "muffled";
export type AccentProfile =
  | "native" | "american" | "british" | "scottish" | "caribbean"
  | "new-york" | "northern" | "west-midlands" | "rp";

export type Voice = {
  id: string;
  serviceId: string;
  name: string;
  accent: string;
  gender: "Male" | "Female";
  engine: VoiceEngine;
};

export type Transmission = {
  id: string;
  role: Role;
  text: string;
};

export const roleLabel: Record<Role, string> = { atc: "Controller", pilot: "Pilot" };
export const roleTag: Record<Role, string> = { atc: "ATC", pilot: "PILOT" };
export const roleChannel: Record<Role, string> = { atc: "CH 1", pilot: "CH 2" };

export const localVoices: Voice[] = ([
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
] as const).map(([id, name, accent, gender]) => ({
  id, serviceId: id, name, accent, gender, engine: "local" as const
}));

export const azureVoices: Voice[] = ([
  ["en-US-AndrewNeural", "Andrew", "American English", "Male"],
  ["en-US-BrianNeural", "Brian", "American English", "Male"],
  ["en-US-AvaNeural", "Ava", "American English", "Female"],
  ["en-US-JennyNeural", "Jenny", "American English", "Female"],
  ["en-GB-RyanNeural", "Ryan", "British English", "Male"],
  ["en-GB-ThomasNeural", "Thomas", "British English", "Male"],
  ["en-GB-SoniaNeural", "Sonia", "British English", "Female"],
  ["en-GB-LibbyNeural", "Libby", "British English", "Female"],
  ["en-IE-ConnorNeural", "Connor", "Irish English", "Male"],
  ["en-IE-EmilyNeural", "Emily", "Irish English", "Female"],
  ["en-IN-PrabhatNeural", "Prabhat", "Indian English", "Male"],
  ["en-IN-ArjunNeural", "Arjun", "Indian English", "Male"],
  ["en-IN-KunalNeural", "Kunal", "Indian English", "Male"],
  ["en-IN-NeerjaNeural", "Neerja", "Indian English", "Female"],
  ["en-IN-AartiNeural", "Aarti", "Indian English", "Female"],
  ["en-IN-AnanyaNeural", "Ananya", "Indian English", "Female"],
  ["it-IT-GiuseppeMultilingualNeural", "Giuseppe", "Italian English", "Male"],
  ["it-IT-AlessioMultilingualNeural", "Alessio", "Italian English", "Male"],
  ["it-IT-MarcelloMultilingualNeural", "Marcello", "Italian English", "Male"],
  ["it-IT-IsabellaMultilingualNeural", "Isabella", "Italian English", "Female"],
  ["de-DE-ConradNeural", "Conrad", "German English", "Male"],
  ["de-DE-FlorianMultilingualNeural", "Florian", "German English", "Male"],
  ["de-DE-KatjaNeural", "Katja", "German English", "Female"],
  ["de-DE-SeraphinaMultilingualNeural", "Seraphina", "German English", "Female"],
  ["bg-BG-BorislavNeural", "Borislav", "Bulgarian English", "Male"],
  ["bg-BG-KalinaNeural", "Kalina", "Bulgarian English", "Female"],
  ["en-AU-WilliamNeural", "William", "Australian English", "Male"],
  ["en-AU-DarrenNeural", "Darren", "Australian English", "Male"],
  ["en-AU-NatashaNeural", "Natasha", "Australian English", "Female"],
  ["en-AU-AnnetteNeural", "Annette", "Australian English", "Female"],
  ["en-CA-LiamNeural", "Liam", "Canadian English", "Male"],
  ["en-CA-ClaraNeural", "Clara", "Canadian English", "Female"],
  ["en-NZ-MitchellNeural", "Mitchell", "New Zealand English", "Male"],
  ["en-NZ-MollyNeural", "Molly", "New Zealand English", "Female"],
  ["en-ZA-LukeNeural", "Luke", "South African English", "Male"],
  ["en-ZA-LeahNeural", "Leah", "South African English", "Female"],
  ["en-HK-SamNeural", "Sam", "Hong Kong English", "Male"],
  ["en-HK-YanNeural", "Yan", "Hong Kong English", "Female"],
  ["en-SG-WayneNeural", "Wayne", "Singapore English", "Male"],
  ["en-SG-LunaNeural", "Luna", "Singapore English", "Female"],
  ["en-PH-JamesNeural", "James", "Philippine English", "Male"],
  ["en-PH-RosaNeural", "Rosa", "Philippine English", "Female"],
  ["en-KE-ChilembaNeural", "Chilemba", "Kenyan English", "Male"],
  ["en-KE-AsiliaNeural", "Asilia", "Kenyan English", "Female"],
  ["en-NG-AbeoNeural", "Abeo", "Nigerian English", "Male"],
  ["en-NG-EzinneNeural", "Ezinne", "Nigerian English", "Female"],
  ["en-TZ-ElimuNeural", "Elimu", "Tanzanian English", "Male"],
  ["en-TZ-ImaniNeural", "Imani", "Tanzanian English", "Female"]
] as const).map(([id, name, accent, gender]) => ({
  id: `azure:${id}`, serviceId: id, name, accent, gender, engine: "azure" as const
}));

export const allVoices: Voice[] = [...localVoices, ...azureVoices];

export const accentOptions: { value: AccentProfile; label: string }[] = [
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

export const effectOptions: { value: EffectName; label: string; detail: string }[] = [
  { value: "clean", label: "Clean voice", detail: "Unfiltered output, no radio colouring." },
  { value: "light", label: "Light radio", detail: "Light band-pass filter." },
  { value: "vhf", label: "VHF radio", detail: "VHF band-pass and compression." },
  { value: "muffled", label: "Muffled recording", detail: "Narrow, low-detail band-pass." }
];

export const bedOptions: { value: string; label: string; detail: string }[] = [
  { value: "none", label: "None", detail: "No background noise." },
  { value: "receiver-hiss", label: "Light receiver hiss", detail: "A quiet, continuous receiver hiss." },
  { value: "vhf-static", label: "VHF static bed", detail: "Steady airband static across voices and reply gaps." },
  { value: "weak-signal", label: "Weak signal", detail: "Uneven static, light fading and occasional crackle." },
  { value: "old-recorder", label: "Old recorder", detail: "Low tape noise, hum and small recording pops." }
];

export const gapOptions: { value: number; label: string }[] = [
  { value: 350, label: "Quick · 0.35 s" },
  { value: 650, label: "Natural · 0.65 s" },
  { value: 1000, label: "Measured · 1.0 s" },
  { value: 1500, label: "Long · 1.5 s" }
];

export const maxTransmissions = 80;
export const maxCharacters = 12_000;

const roleAliases: Record<string, Role> = {
  atc: "atc", controller: "atc", tower: "atc", ground: "atc", approach: "atc",
  departure: "atc", radar: "atc", centre: "atc", center: "atc", delivery: "atc",
  pilot: "pilot", aircraft: "pilot", flight: "pilot", crew: "pilot"
};

let transmissionCounter = 0;

export function newTransmission(role: Role, text = ""): Transmission {
  transmissionCounter += 1;
  return { id: `tx-${transmissionCounter}`, role, text };
}

export function oppositeRole(role: Role): Role {
  return role === "atc" ? "pilot" : "atc";
}

export const sampleTransmissions = (): Transmission[] => [
  newTransmission("atc", "Balkan one two three, Sofia Tower, wind two eight zero degrees, six knots, runway two seven, cleared for takeoff."),
  newTransmission("pilot", "Cleared for takeoff runway two seven, Balkan one two three."),
  newTransmission("atc", "Balkan one two three, contact Sofia Departure on one two four decimal six."),
  newTransmission("pilot", "One two four decimal six, Balkan one two three, good day.")
];

/**
 * Reads a pasted `ATC:` / `PILOT:` script. Unlabelled lines continue the
 * previous transmission. Unlike the export format check, this stays lenient:
 * an empty or single-sided script is a valid work in progress.
 */
export function parseScriptText(input: string): Transmission[] {
  if (input.length > maxCharacters) {
    throw new Error(`Keep the script under ${maxCharacters.toLocaleString("en-GB")} characters.`);
  }

  const transmissions: Transmission[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  for (const [index, sourceLine] of lines.entries()) {
    const line = sourceLine.trim();
    if (!line) continue;

    const match = line.match(/^([^:]{1,24}):\s*(.*)$/);
    if (match) {
      const label = match[1].trim();
      const role = roleAliases[label.toLowerCase()];
      if (!role) {
        throw new Error(`Unknown speaker “${label}” on line ${index + 1}. Use ATC: or PILOT:.`);
      }
      transmissions.push(newTransmission(role, match[2].trim()));
      continue;
    }

    if (!transmissions.length) {
      throw new Error(`Line ${index + 1} needs ATC: or PILOT: at the start.`);
    }
    const previous = transmissions[transmissions.length - 1];
    previous.text = previous.text ? `${previous.text} ${line}` : line;
  }

  return transmissions;
}

export function serializeTransmissions(transmissions: Transmission[]): string {
  return transmissions.map((transmission) => `${roleTag[transmission.role]}: ${transmission.text}`).join("\n\n");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Rough read-aloud estimate: neural voices average about 2.5 words per second. */
export function estimateSeconds(
  transmissions: Transmission[],
  pauseMs: number,
  speedFor: (role: Role) => number
): number {
  const spoken = transmissions.filter((transmission) => transmission.text.trim());
  const speech = spoken.reduce((total, transmission) => {
    return total + countWords(transmission.text) / (2.5 * speedFor(transmission.role));
  }, 0);
  return speech + Math.max(0, spoken.length - 1) * (pauseMs / 1000);
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function rateToSpeed(rate: number): number {
  return Math.max(0.7, Math.min(1.3, 1 + rate / 100));
}

export function engineName(engine: VoiceEngine): string {
  return engine === "azure" ? "Azure" : "Local";
}

export function voiceGroupLabel(voice: Voice): string {
  return `${engineName(voice.engine)} · ${voice.accent}`;
}

export function findVoice(id: string, fallback: Voice): Voice {
  return allVoices.find((voice) => voice.id === id) ?? fallback;
}

export function fileSlug(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "atc-dialogue";
}

export function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while making the audio. Please try again.";
}
