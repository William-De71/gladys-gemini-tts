import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWav, MAX_AUDIO_BYTES, parseWav, resample, toClip } from '../src/audio.js';
import { silence } from './helpers/fake-gemini.js';

const ramp = (count) => {
  const pcm = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    pcm.writeInt16LE(i * 10, i * 2);
  }
  return pcm;
};

test('a WAV is read back as written, extra chunks skipped', () => {
  const wav = buildWav(ramp(100), 24000);
  assert.equal(wav.length, 44 + 200);
  const parsed = parseWav(wav);
  assert.deepEqual(
    [parsed.rate, parsed.channels, parsed.bits, parsed.pcm.length],
    [24000, 1, 16, 200],
  );
  // A LIST chunk before the data, and a data size of 0 (streamed WAV).
  const list = Buffer.from('LIST\x04\x00\x00\x00abcd', 'latin1');
  const header = wav.subarray(0, 36);
  const data = Buffer.from(wav.subarray(36));
  data.writeUInt32LE(0, 4);
  const odd = Buffer.concat([header, list, data]);
  assert.equal(parseWav(odd).pcm.length, 200);
  assert.equal(parseWav(Buffer.from('not a wav at all')), null);
});

test('resampling keeps the shape and the length ratio', () => {
  const out = resample(ramp(300), 24000, 16000);
  assert.equal(out.length / 2, 200);
  assert.equal(out.readInt16LE(0), 0);
  assert.equal(out.readInt16LE(2), 15, 'interpolated between 10 and 20');
  assert.equal(resample(ramp(10), 16000, 16000).length, 20);
});

test('a clip: seconds counted, headerless PCM wrapped, a long clip brought to 16 kHz', () => {
  const short = toClip(silence(2), 'audio/wav', 24000);
  assert.equal(short.seconds, 2);
  assert.equal(short.resampled, false);
  const raw = toClip(Buffer.alloc(48000), 'audio/l16;codec=pcm;rate=24000', 16000);
  assert.equal(raw.seconds, 1);
  assert.equal(parseWav(raw.wav).rate, 24000);
  // 120 s at 24 kHz = 5.76 MB: over the limit, resampled to 3.84 MB.
  const long = toClip(silence(120), 'audio/wav', 24000);
  assert.equal(long.resampled, true);
  assert.equal(Math.round(long.seconds), 120);
  assert.ok(long.wav.length <= MAX_AUDIO_BYTES);
  assert.equal(parseWav(long.wav).rate, 16000);
  assert.throws(() => toClip(Buffer.from('ID3 mp3'), 'audio/mpeg', 24000), /Unexpected audio/);
});
