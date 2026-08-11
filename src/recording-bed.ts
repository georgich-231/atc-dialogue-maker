export type RecordingBed = "none" | "receiver-hiss" | "vhf-static" | "weak-signal" | "old-recorder";

const TAU = Math.PI * 2;

export function applyRecordingBed(
  samples: Float32Array,
  sampleRate: number,
  bed: RecordingBed
) {
  const output = samples.slice();
  if (bed === "none") return output;

  let seed = 0x6d2b79f5;
  let lowNoise = 0;
  let bandNoise = 0;
  let previousWhite = 0;
  let crackle = 0;

  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let index = 0; index < output.length; index += 1) {
    const white = random() * 2 - 1;
    lowNoise += (white - lowNoise) * 0.035;
    const highNoise = white - lowNoise;
    bandNoise += (highNoise - bandNoise) * 0.18;
    const hiss = white - previousWhite * 0.62;
    previousWhite = white;

    let signalGain = 1;
    let noise = 0;

    if (bed === "receiver-hiss") {
      noise = hiss * 0.0055;
    } else if (bed === "vhf-static") {
      noise = bandNoise * 0.013 + hiss * 0.003;
    } else if (bed === "weak-signal") {
      const seconds = index / sampleRate;
      const fade = 0.58 + 0.25 * Math.sin(TAU * 0.23 * seconds) + 0.12 * Math.sin(TAU * 0.71 * seconds);
      signalGain = 0.9 + Math.max(0, Math.min(1, fade)) * 0.08;
      noise = bandNoise * (0.018 + (1 - fade) * 0.012) + hiss * 0.004;
      if (crackle <= 0 && random() > 0.99955) crackle = Math.round(sampleRate * (0.002 + random() * 0.009));
      if (crackle > 0) {
        noise += (random() * 2 - 1) * 0.075 * (crackle / Math.max(1, sampleRate * 0.011));
        crackle -= 1;
      }
    } else {
      const seconds = index / sampleRate;
      noise = lowNoise * 0.014 + hiss * 0.0025;
      noise += Math.sin(TAU * 50 * seconds) * 0.0018;
      signalGain = 0.985 + Math.sin(TAU * 0.31 * seconds) * 0.005;
      if (crackle <= 0 && random() > 0.99982) crackle = Math.round(sampleRate * (0.001 + random() * 0.004));
      if (crackle > 0) {
        noise += (random() * 2 - 1) * 0.045;
        crackle -= 1;
      }
    }

    output[index] = Math.max(-1, Math.min(1, output[index] * signalGain + noise));
  }

  return output;
}
