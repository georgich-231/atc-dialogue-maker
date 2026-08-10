# ATC Dialogue Maker

A two-voice ATC and pilot practice recording maker that runs directly in the browser.

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

- Speech generation runs on the visitor's device. The voice model is downloaded on the first generation and cached by the browser.
- The transmission setting supports clean, light-radio, VHF-radio, and muffled-recording effects.
- Spell the script as it should sound. For example, write `one two four decimal six` rather than `124.6` when that is the desired pronunciation.
- Synthetic audio can mispronounce callsigns, place names, abbreviations, or numbers. Review every recording.
- This app is intended for preparation and training only, never for live operational communication or safety-critical use.

Run parser tests with `npm test` and create a production build with `npm run build`.
