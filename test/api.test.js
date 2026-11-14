import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioOf,
  createGeminiClient,
  ERROR_KINDS,
  errorMessageOf,
  kindOfStatus,
} from '../src/gemini-api.js';
import { apiError, API_KEY, googleError, startFakeGemini } from './helpers/fake-gemini.js';

test('error kinds from both error shapes', () => {
  // The real answer to a bad key (2026-11-14): classic Google error, in an array.
  assert.equal(kindOfStatus(400, googleError(400, 'API key not valid', 'API_KEY_INVALID')), 'auth');
  assert.equal(kindOfStatus(401, apiError('authentication', 'bad key')), 'auth');
  assert.equal(
    kindOfStatus(403, googleError(403, 'Generative Language API has not been used in project 1')),
    'disabled',
  );
  assert.equal(
    kindOfStatus(402, apiError('payment_required', 'Prepay credit depleted')),
    'billing',
  );
  assert.equal(kindOfStatus(400, apiError('failed_precondition', 'enable billing')), 'billing');
  assert.equal(kindOfStatus(429, apiError('quota_exceeded', 'daily quota')), 'quota');
  assert.equal(
    kindOfStatus(
      429,
      googleError(429, 'Quota exceeded for metric: generate_requests_per_model_per_day'),
    ),
    'quota',
  );
  assert.equal(kindOfStatus(429, apiError('rate_limit_exceeded', 'per minute')), 'rate_limit');
  assert.equal(kindOfStatus(404, apiError('model_not_found', 'Model x not found')), 'model');
  assert.equal(
    kindOfStatus(400, apiError('invalid_request', "Voice 'x' does not exist.")),
    'voice',
  );
  assert.equal(kindOfStatus(400, apiError('safety', 'blocked')), 'request');
  assert.equal(kindOfStatus(403, apiError('permission_denied', 'User location')), 'auth');
  assert.equal(kindOfStatus(503, null), 'server');
  assert.equal(kindOfStatus(400, apiError('invalid_request', 'Input too long')), 'request');
});

test('a key never shows in an error message', () => {
  assert.equal(
    errorMessageOf([{ error: { message: `Key AIzaSyA1234567890abcdefXYZ refused` } }]),
    'Key AIza… refused',
  );
});

test('the audio of an interaction: the last audio block, the audio tokens', () => {
  const clip = audioOf({
    status: 'completed',
    steps: [
      { type: 'user_input', content: [{ type: 'text', text: 'x' }] },
      {
        type: 'model_output',
        content: [
          { type: 'audio', data: Buffer.from('one').toString('base64'), mime_type: 'audio/wav' },
          { type: 'audio', data: Buffer.from('two').toString('base64'), mime_type: 'audio/wav' },
        ],
      },
    ],
    usage: {
      total_input_tokens: 7,
      total_output_tokens: 80,
      output_tokens_by_modality: [{ modality: 'audio', tokens: 75 }],
    },
  });
  assert.equal(clip.audio.toString(), 'two');
  assert.deepEqual(clip.tokens, { input: 7, output: 75 });
  assert.throws(() => audioOf({ status: 'failed', steps: [] }), { kind: 'server' });
  assert.throws(() => audioOf({ status: 'incomplete' }), { kind: 'request' });
});

test('synthesize and list against the fake API; the key travels in the header', async (t) => {
  const api = await startFakeGemini();
  t.after(() => api.close());
  const client = createGeminiClient({ getApiKey: () => API_KEY, baseUrl: api.url });
  const voices = await client.listVoices();
  assert.equal(voices.length, 6);
  assert.deepEqual(voices[3], {
    id: 'Camille',
    name: 'Camille',
    type: 'prebuilt',
    language: 'fr-FR',
    gender: 'female',
    description: 'Warm Parisian narrator',
  });
  assert.equal((await client.getVoice('voice_abc123')).name, 'Butler');
  await assert.rejects(client.getVoice('voice_nope'), { status: 404 });
  const clip = await client.synthesize({
    model: 'gemini-3.8-flash-lite-tts',
    input: [{ type: 'user_input', content: [{ type: 'text', text: 'Hallo' }] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: 'Kore' }] },
  });
  assert.equal(clip.audio.toString('ascii', 0, 4), 'RIFF');
  assert.equal(clip.mimeType, 'audio/wav');
  for (const request of api.requests) {
    assert.equal(request.key, API_KEY);
    assert.equal(request.query.key, undefined, 'never in the URL');
  }
});

test('retries 429 per minute and 5xx within the deadline, never a daily quota nor a 400', async (t) => {
  const api = await startFakeGemini();
  t.after(() => api.close());
  const waits = [];
  const client = createGeminiClient({
    getApiKey: () => API_KEY,
    baseUrl: api.url,
    sleep: async (ms) => waits.push(ms),
  });
  api.fail([429, apiError('rate_limit_exceeded', 'slow down')], [500, apiError('api_error', 'x')]);
  assert.equal((await client.listVoices()).length > 0, true);
  assert.deepEqual(waits, [1000, 2000]);
  api.fail([429, apiError('quota_exceeded', 'daily')]);
  await assert.rejects(client.listVoices(), { kind: ERROR_KINDS.QUOTA });
  api.fail([400, apiError('invalid_request', 'Input too long')]);
  await assert.rejects(client.listVoices(), { kind: ERROR_KINDS.REQUEST });
  api.fail(...Array.from({ length: 3 }, () => [503, apiError('service_unavailable', 'down')]));
  await assert.rejects(client.listVoices(), { kind: ERROR_KINDS.SERVER });
  const offline = createGeminiClient({
    getApiKey: () => API_KEY,
    baseUrl: 'http://127.0.0.1:1/v1beta',
    sleep: async () => {},
  });
  await assert.rejects(offline.listVoices(), { kind: ERROR_KINDS.UNREACHABLE });
  const keyless = createGeminiClient({ getApiKey: () => '', baseUrl: api.url });
  await assert.rejects(keyless.listVoices(), { kind: ERROR_KINDS.AUTH });
});

test('a bad key answers 400 in an array: kind auth, message kept', async (t) => {
  const api = await startFakeGemini();
  t.after(() => api.close());
  const client = createGeminiClient({ getApiKey: () => 'AIzaWrong000000000000', baseUrl: api.url });
  await assert.rejects(client.listVoices(), (err) => {
    assert.equal(err.kind, ERROR_KINDS.AUTH);
    assert.equal(err.code, 'invalid_argument');
    assert.match(err.message, /HTTP 400: API key not valid/);
    return true;
  });
});
