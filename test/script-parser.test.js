import test from "node:test";
import assert from "node:assert/strict";
import { parseScript, ScriptParseError } from "../lib/script-parser.js";

test("parses ATC and pilot dialogue", () => {
  assert.deepEqual(parseScript("ATC: Cleared to land.\nPILOT: Cleared to land."), [
    { role: "atc", text: "Cleared to land.", sourceLine: 1 },
    { role: "pilot", text: "Cleared to land.", sourceLine: 2 }
  ]);
});

test("supports aliases and continuation lines", () => {
  const result = parseScript("Tower: Hold short\nof runway two seven.\nAircraft: Holding short.");
  assert.equal(result[0].role, "atc");
  assert.equal(result[0].text, "Hold short of runway two seven.");
  assert.equal(result[1].role, "pilot");
});

test("reports an unknown speaker with its line number", () => {
  assert.throws(
    () => parseScript("DISPATCH: Hello.\nPILOT: Hello."),
    (error) => error instanceof ScriptParseError && /line 1/.test(error.message)
  );
});

test("requires both roles", () => {
  assert.throws(() => parseScript("ATC: One.\nATC: Two."), /both an ATC/);
});
