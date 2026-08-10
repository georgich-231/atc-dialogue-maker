# ATC Dialogue Studio

A local web app that turns a labelled ATC/pilot script into a two-voice MP3 dialogue.

The transmission-sound setting can leave the voices clean or add light radio filtering, a compressed VHF-style sound, or a strongly muffled recording effect. The selected effect is used for previews and the final MP3.

## Run it

Requirements: Node.js 20 or newer and an internet connection.

```powershell
npm install
npm start
```

Then open [http://localhost:4173](http://localhost:4173).

For automatic restarts while editing:

```powershell
npm run dev
```

## Script format

Start each transmission with `ATC:` or `PILOT:`.

```text
ATC: Balkan one two three, runway two seven, cleared for takeoff.
PILOT: Cleared for takeoff runway two seven, Balkan one two three.
```

The aliases `CONTROLLER`, `TOWER`, `GROUND`, `APPROACH`, and `DEPARTURE` are also treated as ATC. `AIRCRAFT` and `FLIGHT` are treated as the pilot. Unlabelled lines continue the previous transmission.

## Notes

- The neural voices are retrieved through Microsoft Edge's online speech service. No API key is needed, but the app needs internet access and the service may change.
- Spell the script as it should sound. For example, write `one two four decimal six` rather than `124.6` when that is the desired pronunciation.
- Synthetic audio can mispronounce callsigns, place names, abbreviations, or numbers. Review every recording.
- This app is intended for preparation and training only, never for live operational communication or safety-critical use.

Run the parser tests with `npm test`. To also contact the voice service and verify MP3 assembly, run `npm run test:live`.
