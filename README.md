# ATC Dialogue Maker

A two-voice ATC dialogue generator with radio effects and MP3 export. It runs directly in the browser.

## Run locally

Requirements: Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open the local address printed by the development server.

## Script format

Start each transmission with `ATC:` or `PILOT:`.

```text
ATC: Balkan one two three, runway two seven, cleared for takeoff.
PILOT: Cleared for takeoff runway two seven, Balkan one two three.
```

The aliases `CONTROLLER`, `TOWER`, `GROUND`, `APPROACH`, and `DEPARTURE` are also treated as ATC. `AIRCRAFT` and `FLIGHT` are treated as the pilot. Unlabelled lines continue the previous transmission.

## Notes

- The local voice engine runs on the visitor's device. Its model is downloaded on the first generation and cached by the browser.
- The voice engine and MP3 encoder run in a background worker. Compatible desktop browsers use WebGPU acceleration, with a WASM fallback.
- iPhone and iPad browsers use the standard single-threaded WASM runtime to avoid WebKit's JSEP inference issue.
- The transmission setting supports clean, light-radio, VHF-radio, and muffled-recording effects.
- Local, Azure, and ElevenLabs voices share one picker for each speaker, so a dialogue can mix any two engines.
- Azure adds Irish, Indian, Italian, German, and Bulgarian English voices. ElevenLabs account voices created with Voice Design can be loaded into the same speaker pickers.
- Azure Speech credentials are entered in the page and saved only in that browser's local storage. They are sent directly to Microsoft Speech and are not included in the site code.
- The optional ElevenLabs key is also stored only in that browser. A restricted key with Text to Speech access, Voices read access, and a credit limit is recommended. Free ElevenLabs API accounts cannot use public Voice Library voices, so the app loads only voices owned by the account.
- A separate recording-sound control can add receiver hiss, VHF static, weak-signal noise, or old-recorder ambience across the full recording, including reply gaps.
- Spell the script as it should sound. For example, write `one two four decimal six` rather than `124.6` when that is the desired pronunciation.
- Synthetic audio can mispronounce callsigns, place names, abbreviations, or numbers. Review every recording.
- Generated audio is intended for offline dialogue work, not live operational communication.

Run parser tests with `npm test` and create a production build with `npm run build`.
