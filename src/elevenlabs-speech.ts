export type ElevenLabsAudioResult = {
  samples: Float32Array;
  sampleRate: number;
};

export async function makeElevenLabsVoice(
  text: string,
  voiceId: string,
  accentDirection: string,
  speed: number,
  key: string
): Promise<ElevenLabsAudioResult> {
  if (!key.trim()) throw new Error("Add the ElevenLabs API key under Voice service settings first.");

  let response: Response;
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": key.trim()
        },
        body: JSON.stringify({
          text: `${accentDirection} ${text}`,
          model_id: "eleven_v3",
          language_code: "en",
          voice_settings: {
            stability: 0.58,
            similarity_boost: 0.72,
            style: 0.35,
            use_speaker_boost: true,
            speed: Math.max(0.7, Math.min(1.3, speed))
          }
        })
      }
    );
  } catch {
    throw new Error("ElevenLabs could not connect. Check the internet connection and try again.");
  }

  if (!response.ok) throw await friendlyElevenLabsError(response);
  const encodedAudio = await response.arrayBuffer();
  return decodeBrowserAudio(encodedAudio);
}

async function decodeBrowserAudio(encodedAudio: ArrayBuffer): Promise<ElevenLabsAudioResult> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(encodedAudio.slice(0));
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const source = decoded.getChannelData(channel);
      for (let index = 0; index < samples.length; index += 1) samples[index] += source[index] / decoded.numberOfChannels;
    }
    return { samples, sampleRate: decoded.sampleRate };
  } catch {
    throw new Error("ElevenLabs returned audio that this browser could not decode.");
  } finally {
    void context.close();
  }
}

async function friendlyElevenLabsError(response: Response) {
  let details = "";
  try {
    const body = await response.json() as { detail?: string | { message?: string } };
    details = typeof body.detail === "string" ? body.detail : body.detail?.message ?? "";
  } catch {
    // The status-specific message below is enough when no JSON body is returned.
  }

  if (response.status === 401 || response.status === 403) {
    return new Error("The ElevenLabs key was rejected or does not have text-to-speech access.");
  }
  if (response.status === 429 || /quota|credit|limit/i.test(details)) {
    return new Error("The ElevenLabs monthly credits or request limit has been reached.");
  }
  return new Error(details || `ElevenLabs generation failed (${response.status}).`);
}
