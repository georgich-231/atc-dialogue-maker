export type CloudDialogueLine = {
  text: string;
  voice: string;
  speed: number;
};

export type CloudAudioResult = {
  samples: Float32Array;
  sampleRate: number;
};

export async function makeCloudVoicePreview(
  text: string,
  voice: string,
  speed: number,
  key: string,
  region: string
) {
  validateCredentials(key, region);
  return synthesizeSsml(makeSsml([{ text, voice, speed }], 0), key.trim(), region.trim());
}

export async function makeCloudDialogueAudio(
  lines: CloudDialogueLine[],
  pauseMs: number,
  key: string,
  region: string
) {
  validateCredentials(key, region);
  if (!lines.length) throw new Error("The dialogue has no transmissions.");
  return synthesizeSsml(makeSsml(lines, pauseMs), key.trim(), region.trim());
}

async function synthesizeSsml(
  ssml: string,
  key: string,
  region: string
): Promise<CloudAudioResult> {
  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

  try {
    const audioData = await new Promise<ArrayBuffer>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted && result.audioData?.byteLength) {
            resolve(result.audioData);
          } else {
            reject(new Error(result.errorDetails || "Cloud speech synthesis did not return audio."));
          }
        },
        (error) => reject(new Error(String(error)))
      );
    });
    return decodePcmWav(audioData);
  } catch (error) {
    throw friendlyCloudError(error);
  } finally {
    synthesizer.close();
  }
}

function makeSsml(lines: CloudDialogueLine[], pauseMs: number) {
  const transmissions = lines.map((line, index) => {
    const rate = Math.round((Math.max(0.7, Math.min(1.3, line.speed)) - 1) * 100);
    const pause = index < lines.length - 1 && pauseMs > 0 ? `<break time="${Math.round(pauseMs)}ms"/>` : "";
    return [
      `<voice name="${escapeXml(line.voice)}">`,
      `<lang xml:lang="en-US"><prosody rate="${rate >= 0 ? "+" : ""}${rate}%">${escapeXml(line.text)}</prosody></lang>`,
      pause,
      "</voice>"
    ].join("");
  }).join("");

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">${transmissions}</speak>`;
}

function decodePcmWav(data: ArrayBuffer): CloudAudioResult {
  const view = new DataView(data);
  if (readText(view, 0, 4) !== "RIFF" || readText(view, 8, 4) !== "WAVE") {
    throw new Error("The cloud engine returned an unsupported audio file.");
  }

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const chunkName = readText(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkData = offset + 8;
    if (chunkData + chunkLength > view.byteLength) break;

    if (chunkName === "fmt " && chunkLength >= 16) {
      format = view.getUint16(chunkData, true);
      channels = view.getUint16(chunkData + 2, true);
      sampleRate = view.getUint32(chunkData + 4, true);
      bitsPerSample = view.getUint16(chunkData + 14, true);
    } else if (chunkName === "data") {
      dataOffset = chunkData;
      dataLength = chunkLength;
      break;
    }
    offset = chunkData + chunkLength + (chunkLength % 2);
  }

  if (format !== 1 || !channels || bitsPerSample !== 16 || !sampleRate || !dataOffset) {
    throw new Error("The cloud engine returned an unsupported audio format.");
  }

  const frameCount = Math.floor(dataLength / (channels * 2));
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let total = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      total += view.getInt16(dataOffset + (frame * channels + channel) * 2, true) / 0x8000;
    }
    samples[frame] = total / channels;
  }
  return { samples, sampleRate };
}

function validateCredentials(key: string, region: string) {
  if (!key.trim() || !region.trim()) {
    throw new Error("Add the Azure Speech key and region under Cloud engine settings first.");
  }
  if (!/^[a-z0-9-]+$/i.test(region.trim())) {
    throw new Error("The Azure region should look like westeurope or eastus.");
  }
}

function friendlyCloudError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|403|unauthorized|authentication|subscription/i.test(message)) {
    return new Error("The Azure Speech key or region was rejected.");
  }
  if (/429|quota|throttl/i.test(message)) {
    return new Error("The Azure Speech free limit is busy or has been reached. Try again shortly.");
  }
  if (/network|websocket|connect|fetch/i.test(message)) {
    return new Error("The cloud voice engine could not connect. Check the internet connection and try again.");
  }
  return new Error(message || "The cloud voice engine failed.");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function readText(view: DataView, offset: number, length: number) {
  let text = "";
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index));
  return text;
}
