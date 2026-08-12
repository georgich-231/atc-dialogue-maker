# ATC Dialogue Studio

An internal tool for building controller and pilot dialogue recordings. A dialogue is written one
transmission at a time, each speaker gets its own voice channel, and the result is exported as a
single MP3 with the chosen radio character. Everything runs in the browser.

## Run locally

Requirements: Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open the local address printed by the development server.

## Building a dialogue

The **Strips** view holds one transmission per row. The tag on the left switches a row between the
controller and the pilot, the play button on the right speaks that single transmission, and the
arrows reorder it.

| Key | Action |
| --- | --- |
| `Enter` | Add the reply below, already set to the other speaker |
| `Shift` + `Enter` | New line inside the same transmission |
| `Alt` + `↑` / `↓` | Move the transmission up or down |
| `Backspace` on an empty row | Delete the row |
| `Ctrl` / `Cmd` + `Enter` | Build the recording |

The **Script text** view is the same dialogue as plain text, for pasting a script written elsewhere.
Start each transmission with `ATC:` or `PILOT:`.

```text
ATC: Balkan one two three, runway two seven, cleared for takeoff.
PILOT: Cleared for takeoff runway two seven, Balkan one two three.
```

`CONTROLLER`, `TOWER`, `GROUND`, `APPROACH`, `DEPARTURE`, `RADAR`, `CENTRE` and `DELIVERY` also
count as the controller. `AIRCRAFT`, `FLIGHT` and `CREW` count as the pilot. Unlabelled lines
continue the previous transmission. The two views stay in sync, so either can be used at any point.

The exercise name is used for the exported file name, and the current draft is kept in the browser
so a closed tab does not lose the work.

## Voices and audio

- Each speaker has a voice channel with its own voice, accent and speech rate.
- Local voices run on the device. The model is downloaded on the first generation and cached by the
  browser. Compatible desktop browsers use WebGPU acceleration, with a WASM fallback; iPhone and iPad
  use the single-threaded WASM runtime to avoid WebKit's JSEP inference issue.
- Azure voices add American, British, Irish, Indian, Italian, German, Bulgarian, Australian,
  Canadian, New Zealand, South African, Hong Kong, Singapore, Philippine, Kenyan, Nigerian and
  Tanzanian English. Local and Azure voices share one picker, so a dialogue can mix both engines.
- Azure Speech credentials are entered in the page and saved only in that browser's local storage.
  They are sent directly to Microsoft Speech and are not included in the site code.
- **Transmission filter** shapes each voice: clean, light radio, VHF radio or muffled recording.
- **Background sound** lays receiver hiss, VHF static, weak-signal fading or old-recorder ambience
  across the whole recording, including the reply gaps.

## Notes

- Spell the script as it should sound. Write `one two four decimal six` rather than `124.6` when that
  is the desired pronunciation.
- Synthetic audio can mispronounce callsigns, place names, abbreviations and numbers. Review every
  recording before it is used.
- Generated audio is intended for offline dialogue and training work, not live operational
  communication.

Run parser tests with `npm test` and create a production build with `npm run build`.
