// -----------------------------------------------------------------------------
// The audio Gemini returns, made fit for Gladys.
//
// Gemini 3.8 TTS answers a complete WAV (RIFF header, 16-bit signed little
// endian PCM, mono, 24 kHz by default); older models answered headerless PCM
// (`audio/l16`). The core accepts `audio/wav`, 5 MB decoded at most: about
// 109 seconds at 24 kHz, a long assistant reply can go over. Rather than
// failing such a clip, it is resampled to 16 kHz (164 seconds fit), still
// clear for speech. Pure functions, no dependency.
// -----------------------------------------------------------------------------

/** Decoded size the core accepts. */
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** The rate a too-long clip is brought down to. */
export const FALLBACK_RATE = 16_000;

const HEADER_BYTES = 44;

/**
 * @description Read a WAV file: format and PCM samples.
 * @param {Buffer} buffer - The file.
 * @returns {{ rate: number, channels: number, bits: number, pcm: Buffer }|null} The audio, null when not a PCM WAV.
 */
export function parseWav(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 12 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    return null;
  }
  let format = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    let size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && start + 16 <= buffer.length) {
      format = {
        code: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        rate: buffer.readUInt32LE(start + 4),
        bits: buffer.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      if (!format || format.code !== 1) {
        return null;
      }
      // A streamed WAV may announce 0 or 0xFFFFFFFF: the data runs to the end.
      if (size === 0 || start + size > buffer.length) {
        size = buffer.length - start;
      }
      return {
        rate: format.rate,
        channels: format.channels,
        bits: format.bits,
        pcm: buffer.subarray(start, start + size),
      };
    }
    offset = start + size + (size % 2);
  }
  return null;
}

/**
 * @description Wrap 16-bit PCM in a WAV header.
 * @param {Buffer} pcm - The samples.
 * @param {number} rate - The sample rate.
 * @param {number} [channels] - The channels.
 * @returns {Buffer} The WAV file.
 */
export function buildWav(pcm, rate, channels = 1) {
  const header = Buffer.alloc(HEADER_BYTES);
  const blockAlign = channels * 2;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * @description Resample mono 16-bit PCM by linear interpolation (speech: no
 * audible difference between 24 and 16 kHz on a home speaker).
 * @param {Buffer} pcm - The samples.
 * @param {number} from - Their rate.
 * @param {number} to - The rate wanted.
 * @returns {Buffer} The resampled samples.
 */
export function resample(pcm, from, to) {
  const count = Math.floor(pcm.length / 2);
  if (from === to || count === 0) {
    return Buffer.from(pcm.subarray(0, count * 2));
  }
  const length = Math.max(1, Math.floor((count * to) / from));
  const out = Buffer.alloc(length * 2);
  const ratio = from / to;
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, count - 1);
    const fraction = position - index;
    const a = pcm.readInt16LE(index * 2);
    const b = pcm.readInt16LE(next * 2);
    out.writeInt16LE(Math.round(a + (b - a) * fraction), i * 2);
  }
  return out;
}

/**
 * @description The clip Gladys receives: a WAV of 5 MB at most.
 * @param {Buffer} audio - What Gemini returned.
 * @param {string} mimeType - Its MIME type (`audio/wav`, `audio/l16`…).
 * @param {number} rate - The rate asked (used for headerless PCM).
 * @returns {{ wav: Buffer, seconds: number, resampled: boolean }} The clip.
 */
export function toClip(audio, mimeType, rate) {
  let parsed = parseWav(audio);
  if (!parsed) {
    if (!/^audio\/(l16|pcm)/.test(mimeType)) {
      throw new Error(`Unexpected audio from Gemini: ${mimeType}, ${audio.length} bytes`);
    }
    const match = /rate=(\d+)/.exec(mimeType);
    parsed = { rate: match ? Number(match[1]) : rate, channels: 1, bits: 16, pcm: audio };
  }
  if (parsed.bits !== 16 || parsed.channels !== 1 || !(parsed.rate > 0)) {
    throw new Error(
      `Unexpected audio format: ${parsed.bits} bits, ${parsed.channels} channels, ${parsed.rate} Hz`,
    );
  }
  const seconds = parsed.pcm.length / 2 / parsed.rate;
  let wav = parseWav(audio) ? audio : buildWav(parsed.pcm, parsed.rate);
  let resampled = false;
  if (wav.length > MAX_AUDIO_BYTES && parsed.rate > FALLBACK_RATE) {
    wav = buildWav(resample(parsed.pcm, parsed.rate, FALLBACK_RATE), FALLBACK_RATE);
    resampled = true;
  }
  return { wav, seconds, resampled };
}
