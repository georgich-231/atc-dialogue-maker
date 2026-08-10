const ROLE_ALIASES = new Map([
  ["atc", "atc"],
  ["controller", "atc"],
  ["tower", "atc"],
  ["ground", "atc"],
  ["approach", "atc"],
  ["departure", "atc"],
  ["pilot", "pilot"],
  ["aircraft", "pilot"],
  ["flight", "pilot"]
]);

export class ScriptParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScriptParseError";
  }
}

export function parseScript(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new ScriptParseError("Paste a dialogue script first.");
  }

  if (input.length > 12_000) {
    throw new ScriptParseError("The script is too long. Keep it under 12,000 characters.");
  }

  const dialogue = [];
  const sourceLines = input.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < sourceLines.length; index += 1) {
    const rawLine = sourceLines[index].trim();
    if (!rawLine) continue;

    const match = rawLine.match(/^([^:]{1,24}):\s*(.+)$/);
    if (match) {
      const label = match[1].trim().toLowerCase();
      const role = ROLE_ALIASES.get(label);
      if (!role) {
        throw new ScriptParseError(
          `Unknown speaker “${match[1].trim()}” on line ${index + 1}. Use ATC: or PILOT:.`
        );
      }

      dialogue.push({ role, text: match[2].trim(), sourceLine: index + 1 });
      continue;
    }

    if (dialogue.length === 0) {
      throw new ScriptParseError(
        `Line ${index + 1} needs a speaker label. Start it with ATC: or PILOT:.`
      );
    }

    dialogue[dialogue.length - 1].text += ` ${rawLine}`;
  }

  if (dialogue.length < 2) {
    throw new ScriptParseError("Add at least two transmissions to make a dialogue.");
  }

  if (dialogue.length > 80) {
    throw new ScriptParseError("The script has too many transmissions. Keep it to 80 or fewer.");
  }

  const roles = new Set(dialogue.map((line) => line.role));
  if (roles.size < 2) {
    throw new ScriptParseError("The script needs both an ATC: line and a PILOT: line.");
  }

  return dialogue;
}
