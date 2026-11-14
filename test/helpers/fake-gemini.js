// A fake Gemini API on 127.0.0.1, close to the real one: `x-goog-api-key`
// checked (a bad key is a 400 API_KEY_INVALID inside an array, as Google
// answers it), GET /v1beta/voices with a few catalog and custom voices,
// GET /v1beta/voices/{id}, POST /v1beta/interactions answering a short WAV
// whose length follows the text. `fail` queues error answers; `requests`
// records what arrived; `setSeconds` sets the length of the next clips and
// `setAudioTokens` the audio tokens reported. Nothing starts on import.

import { createServer } from 'node:http';
import { buildWav } from '../../src/audio.js';

export const API_KEY = 'AIzaFakeKeyForTheTests0123456789';

export const VOICES = [
  { type: 'prompted', id: 'voice_abc123', display_name: 'Butler', language_code: 'en-GB' },
  { type: 'prebuilt', id: 'Kore', display_name: 'Kore', gender: 'female' },
  { type: 'prebuilt', id: 'Charon', display_name: 'Charon', gender: 'male' },
  {
    type: 'prebuilt',
    id: 'Camille',
    display_name: 'Camille',
    language_code: 'fr-FR',
    gender: 'female',
    description: 'Warm Parisian narrator',
  },
  {
    type: 'prebuilt',
    id: 'Lucien',
    display_name: 'Lucien',
    language_code: 'fr-CA',
    gender: 'male',
  },
  {
    type: 'prebuilt',
    id: 'Greta',
    display_name: 'Greta',
    language_code: 'de-DE',
    gender: 'female',
  },
];

/**
 * @description A classic Google error body (the bad key), in an array.
 * @param {number} code - The HTTP status.
 * @param {string} message - The message.
 * @param {string} [reason] - The ErrorInfo reason.
 * @returns {Array<object>} The body.
 */
export function googleError(code, message, reason) {
  return [
    {
      error: {
        code,
        message,
        status: code === 400 ? 'INVALID_ARGUMENT' : code === 429 ? 'RESOURCE_EXHAUSTED' : 'UNKNOWN',
        details: reason
          ? [
              {
                '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason,
                domain: 'googleapis.com',
              },
            ]
          : [],
      },
    },
  ];
}

/**
 * @description An Interactions API error body.
 * @param {string} code - `invalid_request`, `quota_exceeded`…
 * @param {string} message - The message.
 * @returns {object} The body.
 */
export function apiError(code, message) {
  return { error: { code, message } };
}

/**
 * @description A WAV of silence of a length.
 * @param {number} seconds - The length.
 * @param {number} rate - The sample rate.
 * @returns {Buffer} The WAV.
 */
export function silence(seconds, rate = 24000) {
  return buildWav(Buffer.alloc(Math.round(seconds * rate) * 2), rate);
}

/**
 * @description Start the fake API.
 * @returns {Promise<object>} `{ url, requests, fail, setSeconds, close }`.
 */
export async function startFakeGemini() {
  const requests = [];
  const failures = [];
  let seconds = null;
  let audioTokens = null;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const body = raw ? JSON.parse(raw) : null;
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        key: req.headers['x-goog-api-key'],
        body,
      });
      const send = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (failures.length > 0) {
        const [status, payload] = failures.shift();
        send(status, payload);
        return;
      }
      if (req.headers['x-goog-api-key'] !== API_KEY) {
        send(
          400,
          googleError(400, 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID'),
        );
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1beta/voices') {
        const size = Number(url.searchParams.get('page_size') ?? 50);
        send(200, { voices: VOICES.slice(0, size) });
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/v1beta/voices/')) {
        const id = decodeURIComponent(url.pathname.split('/').pop());
        const voice = VOICES.find((entry) => entry.id === id);
        if (voice) {
          send(200, voice);
        } else {
          send(404, apiError('not_found', `Voice ${id} not found.`));
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1beta/interactions') {
        const voice = body?.generation_config?.speech_config?.[0]?.voice;
        if (!VOICES.some((entry) => entry.id === voice) && !voice?.startsWith('voicekey_')) {
          send(400, apiError('invalid_request', `Voice '${voice}' does not exist.`));
          return;
        }
        if (!String(body?.model ?? '').endsWith('-tts')) {
          send(404, apiError('model_not_found', `Model ${body?.model} not found.`));
          return;
        }
        const text = body.input[0].content[0].text;
        const rate = body.response_format?.sample_rate ?? 24000;
        const length = seconds ?? Math.max(0.5, text.length / 15);
        const audio = silence(length, rate);
        const tokens = audioTokens ?? Math.round(length * 25);
        send(200, {
          id: 'v1_fake',
          object: 'interaction',
          status: 'completed',
          model: body.model,
          steps: [
            {
              type: 'model_output',
              content: [{ type: 'audio', data: audio.toString('base64'), mime_type: 'audio/wav' }],
            },
          ],
          usage: {
            total_input_tokens: Math.ceil(text.length / 4),
            total_output_tokens: tokens,
            output_tokens_by_modality: [{ modality: 'audio', tokens }],
            total_tokens: Math.ceil(text.length / 4) + tokens,
          },
        });
        return;
      }
      send(404, apiError('not_found', 'Not found'));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/v1beta`,
    requests,
    /**
     * @description Queue error answers.
     * @param {...[number, object]} answers - `[status, body]` pairs.
     */
    fail(...answers) {
      failures.push(...answers);
    },
    /**
     * @description The length of the next clips (null: from the text).
     * @param {number|null} value - Seconds.
     */
    setSeconds(value) {
      seconds = value;
    },
    /**
     * @description The audio tokens reported for the next clips (null: 25 per second).
     * @param {number|null} value - Tokens.
     */
    setAudioTokens(value) {
      audioTokens = value;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
