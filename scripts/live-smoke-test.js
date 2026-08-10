import { once } from "node:events";
import { app } from "../server.js";

const server = app.listen(0);
await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const voicesResponse = await fetch(`${baseUrl}/api/voices`);
  const voices = await voicesResponse.json();
  if (!voicesResponse.ok || voices.length < 2) throw new Error("Voice catalogue check failed.");
  console.log(`Voice catalogue: ${voices.length} voices`);

  const previewResponse = await fetch(`${baseUrl}/api/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Balkan one two three, Sofia Tower, radio check.",
      voice: "en-GB-RyanNeural",
      rate: 0,
      radioEffect: "muffled"
    })
  });
  const preview = Buffer.from(await previewResponse.arrayBuffer());
  if (!previewResponse.ok || preview.length < 1_000) {
    throw new Error(`Voice preview check failed: ${preview.toString("utf8")}`);
  }
  console.log(`Voice preview: ${(preview.length / 1024).toFixed(1)} KB`);

  const dialogueResponse = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: "ATC: Balkan one two three, runway two seven, cleared for takeoff.\nPILOT: Cleared for takeoff runway two seven, Balkan one two three.",
      atcVoice: "en-GB-RyanNeural",
      pilotVoice: "en-US-JennyNeural",
      atcRate: 0,
      pilotRate: 0,
      pauseMs: 350,
      radioEffect: "vhf"
    })
  });
  const dialogue = Buffer.from(await dialogueResponse.arrayBuffer());
  if (!dialogueResponse.ok || dialogue.length < 5_000) {
    throw new Error(`Dialogue generation check failed: ${dialogue.toString("utf8")}`);
  }
  console.log(`Combined MP3: ${(dialogue.length / 1024).toFixed(1)} KB`);
  console.log("Live smoke test passed.");
} finally {
  server.close();
}
