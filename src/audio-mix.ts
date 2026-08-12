import type { EffectName } from "./dialogue";

export type AudioClip = { samples: Float32Array; sampleRate: number };

export function joinAudioClips(clips: AudioClip[], pauseMs: number): AudioClip {
  const sampleRate = 24_000;
  const normalized = clips.map((clip) => resampleAudio(clip.samples, clip.sampleRate, sampleRate));
  const gapLength = Math.round(sampleRate * Math.max(0, pauseMs) / 1000);
  const totalLength = normalized.reduce((total, samples) => total + samples.length, 0)
    + gapLength * Math.max(0, normalized.length - 1);
  const joined = new Float32Array(totalLength);

  let offset = 0;
  normalized.forEach((samples, index) => {
    joined.set(samples, offset);
    offset += samples.length;
    if (index < normalized.length - 1) offset += gapLength;
  });
  return { samples: joined, sampleRate };
}

export function resampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const length = Math.max(1, Math.round(samples.length * toRate / fromRate));
  const output = new Float32Array(length);
  const ratio = fromRate / toRate;

  for (let index = 0; index < length; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourcePosition - left;
    output[index] = samples[left] * (1 - fraction) + samples[right] * fraction;
  }
  return output;
}

export async function applyEffect(samples: Float32Array, sampleRate: number, effect: EffectName) {
  if (effect === "clean") return samples.slice();

  const context = new OfflineAudioContext(1, samples.length, sampleRate);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(Float32Array.from(samples), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;

  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = effect === "light" ? 180 : effect === "vhf" ? 300 : 350;
  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = effect === "light" ? 4200 : effect === "vhf" ? 3400 : 2300;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = effect === "light" ? -18 : effect === "vhf" ? -20 : -22;
  compressor.ratio.value = effect === "light" ? 2.5 : effect === "vhf" ? 3.5 : 4.5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.08;
  const gain = context.createGain();
  gain.gain.value = effect === "light" ? 1.05 : effect === "vhf" ? 1.1 : 1.15;

  source.connect(highPass).connect(lowPass).connect(compressor).connect(gain).connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return rendered.getChannelData(0).slice();
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeText(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}
