// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`) and a fake Gemini API
// (test/helpers/fake-gemini.js), a real HTTP server on 127.0.0.1. No test
// touches the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate as tick } from 'node:timers/promises';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTIONS, createApp } from '../src/app.js';
import { parseWav } from '../src/audio.js';
import { TRIGGERS } from '../src/events.js';
import { WIDGETS } from '../src/widgets.js';
import { apiError, API_KEY, startFakeGemini } from './helpers/fake-gemini.js';

const NOW = Date.parse('2026-11-14T10:00:00Z');

const start = async (t, config = { api_key: API_KEY }, { now = () => NOW } = {}) => {
  const api = await startFakeGemini();
  const dir = await mkdtemp(join(tmpdir(), 'gtts-app-'));
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    baseUrl: api.url,
    sleep: async () => {},
    usageFile: join(dir, 'usage.json'),
    clipsDir: join(dir, 'clips'),
    timeZone: 'Europe/Paris',
    now,
  });
  await gladys.connect();
  await app.whenReady();
  t.after(async () => {
    app.usage.stop();
    await gladys.disconnect?.();
    await api.close();
    await rm(dir, { recursive: true, force: true });
  });
  return { api, gladys, app, dir };
};

const lastStatus = (gladys) => gladys.fake.connectionStatuses.at(-1);
const decode = (audio) => {
  const [type, payload] = audio.split(';base64,');
  return { type, bytes: Buffer.from(payload, 'base64') };
};
const synth = (api) => api.requests.filter((r) => r.path.endsWith('/interactions'));
const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await tick();
  }
};

test('connects: one voice listed, nothing generated, status OK', async (t) => {
  const { api, gladys } = await start(t);
  assert.deepEqual(
    api.requests.map((r) => `${r.method} ${r.path} ${r.query.page_size ?? ''}`),
    ['GET /v1beta/voices 1'],
  );
  assert.equal(api.requests[0].key, API_KEY);
  assert.equal(lastStatus(gladys).connected, true);
});

test('without a key: status explains it, nothing is called, a clip fails clearly', async (t) => {
  const { api, gladys } = await start(t, {});
  assert.equal(api.requests.length, 0);
  assert.equal(lastStatus(gladys).connected, false);
  assert.match(JSON.stringify(lastStatus(gladys)), /No Gemini API key/);
  const ack = await gladys.fake.ttsSynthesize('Bonjour', 'fr');
  assert.equal(ack.success, false);
});

test('a bad key: status down with the reason', async (t) => {
  const { gladys } = await start(t, { api_key: 'AIzaWrongKey0000000000000' });
  assert.equal(lastStatus(gladys).connected, false);
  assert.match(JSON.stringify(lastStatus(gladys)), /refused the API key/);
});

test('speaks a text as WAV with the voice, the model and the style', async (t) => {
  const { api, gladys, app } = await start(t, {
    api_key: API_KEY,
    voice: 'Charon',
    model: 'gemini-3.8-flash-tts',
    style: 'calm and warm',
  });
  const ack = await gladys.fake.ttsSynthesize('**La porte** est ouverte 🚪 <laugh>', 'fr');
  assert.equal(ack.success, true, JSON.stringify(ack));
  const { type, bytes } = decode(ack.data.audio);
  assert.equal(type, 'audio/wav');
  assert.equal(parseWav(bytes).rate, 24000);
  assert.deepEqual(synth(api).at(-1).body, {
    model: 'gemini-3.8-flash-tts',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: 'La porte est ouverte <laugh>',
            annotations: [{ type: 'speech_metadata', style: 'calm and warm' }],
          },
        ],
      },
    ],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: 'Charon' }] },
    store: false,
  });
  const month = app.usage.snapshot().month;
  assert.equal(month.clips, 1);
  assert.ok(month.seconds > 0);
  assert.equal(month.cost, 0, 'free tier: nothing spent');
});

test('a custom voice id and 16 kHz reach Gemini', async (t) => {
  const { api, gladys } = await start(t, {
    api_key: API_KEY,
    custom_voice: 'voice_abc123',
    sample_rate: '16000',
  });
  // The check looked the stored voice up.
  assert.ok(api.requests.some((r) => r.path === '/v1beta/voices/voice_abc123'));
  assert.equal(lastStatus(gladys).connected, true);
  const ack = await gladys.fake.ttsSynthesize('Good morning', 'en');
  assert.equal(ack.success, true, JSON.stringify(ack));
  const sent = synth(api).at(-1).body;
  assert.deepEqual(sent.generation_config.speech_config, [{ voice: 'voice_abc123' }]);
  assert.equal(sent.response_format.sample_rate, 16000);
  assert.equal(sent.input[0].content[0].annotations, undefined, 'no style, no annotation');
});

test('a sentence already spoken comes from the cache: no call, nothing counted', async (t) => {
  const { api, gladys, app, dir } = await start(t);
  await gladys.fake.ttsSynthesize('Le linge est prêt', 'fr');
  // The cache is written after the clip is returned.
  for (let i = 0; i < 50 && (await app.cache.stats()).files === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const calls = api.requests.length;
  const again = await gladys.fake.ttsSynthesize('Le linge est prêt', 'fr');
  assert.equal(again.success, true);
  assert.equal(api.requests.length, calls);
  assert.equal(app.usage.snapshot().month.clips, 1);
  assert.equal(app.usage.snapshot().month.cached, 1);
  assert.equal((await readdir(join(dir, 'clips'))).length, 1);
  const cleared = await gladys.fake.action(ACTIONS.CLEAR_CACHE);
  assert.match(JSON.stringify(cleared), /1 clips removed/);
});

test('a long reply over 5 MB is brought down to 16 kHz', async (t) => {
  const { api, gladys } = await start(t);
  api.setSeconds(120);
  const ack = await gladys.fake.ttsSynthesize('Une très longue réponse.', 'fr');
  assert.equal(ack.success, true, JSON.stringify(ack));
  const { bytes } = decode(ack.data.audio);
  assert.equal(parseWav(bytes).rate, 16000);
  assert.ok(bytes.length <= 5 * 1024 * 1024);
});

test('the paid budget: costs counted, warning at 80 %, then refused without calling Gemini', async (t) => {
  const { api, gladys, app } = await start(t, {
    api_key: API_KEY,
    tier: 'paid',
    monthly_budget: '0.5',
  });
  // 13,500 audio tokens (9 minutes) on Flash-Lite at $6 / M = $0.081 a clip.
  api.setAudioTokens(13_500);
  for (let i = 0; i < 6; i += 1) {
    const ack = await gladys.fake.ttsSynthesize(`Annonce numéro ${i}`, 'fr');
    assert.equal(ack.success, true, JSON.stringify(ack));
  }
  await settle();
  assert.ok(Math.abs(app.usage.used() - 0.486) < 0.001, String(app.usage.used()));
  const warning = gladys.fake.sceneEvents.find((e) => e.key === TRIGGERS.MONTHLY_LIMIT);
  assert.equal(warning?.data.level, 'warning');
  assert.equal(warning.data.limit, 0.5);
  assert.equal(warning.data.month, '2026-11');
  // The next long text (about $0.019 estimated) would go over: refused before spending.
  const calls = synth(api).length;
  const refused = await gladys.fake.ttsSynthesize('x'.repeat(1500), 'fr');
  await settle();
  assert.equal(refused.success, false);
  assert.equal(synth(api).length, calls);
  assert.deepEqual(
    gladys.fake.sceneEvents
      .filter((e) => e.key === TRIGGERS.MONTHLY_LIMIT)
      .map((e) => e.data.level),
    ['warning', 'reached'],
  );
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.ERROR).length, 0);
  assert.match(JSON.stringify(lastStatus(gladys)), /Monthly budget/);
  assert.equal(app.usage.snapshot().month.refused, 1);
});

test('a daily quota: one error event, status down, then recovery', async (t) => {
  const { api, gladys } = await start(t);
  const quota = [
    429,
    apiError('quota_exceeded', 'Quota exceeded for metric: generate_requests_per_model_per_day'),
  ];
  api.fail(quota);
  const first = await gladys.fake.ttsSynthesize('Un', 'fr');
  api.fail(quota);
  const second = await gladys.fake.ttsSynthesize('Deux', 'fr');
  await settle();
  assert.equal(first.success, false);
  assert.equal(second.success, false);
  assert.equal(synth(api).length, 2, 'a daily quota is not retried');
  const errors = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.ERROR);
  assert.equal(errors.length, 1);
  assert.deepEqual(
    [errors[0].data.kind, errors[0].data.voice, errors[0].data.language],
    ['quota', 'Kore', 'fr'],
  );
  assert.match(JSON.stringify(lastStatus(gladys)), /Daily quota/);

  const ok = await gladys.fake.ttsSynthesize('Trois', 'fr');
  await settle();
  assert.equal(ok.success, true);
  assert.equal(gladys.fake.sceneEvents.at(-1).key, TRIGGERS.RECOVERED);
  assert.equal(lastStatus(gladys).connected, true);
});

test('a 5xx is retried; a refused text or a safety block start no event', async (t) => {
  const { api, gladys } = await start(t);
  api.fail([503, apiError('service_unavailable', 'Unavailable')]);
  const ack = await gladys.fake.ttsSynthesize('Bonjour', 'fr');
  assert.equal(ack.success, true, JSON.stringify(ack));
  const empty = await gladys.fake.ttsSynthesize('🎉 ** **', 'fr');
  api.fail([400, apiError('safety', 'blocked')]);
  const blocked = await gladys.fake.ttsSynthesize('Texte bloqué', 'fr');
  await settle();
  assert.equal(empty.success, false);
  assert.equal(blocked.success, false);
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.ERROR).length, 0);
});

test('an unknown custom voice warns at check time and fails as voice', async (t) => {
  const { gladys } = await start(t, { api_key: API_KEY, custom_voice: 'Nobody' });
  assert.equal(lastStatus(gladys).connected, true);
  const ack = await gladys.fake.ttsSynthesize('Bonjour', 'fr');
  await settle();
  assert.equal(ack.success, false);
  assert.equal(gladys.fake.sceneEvents.at(-1).data.kind, 'voice');
});

test('test button: speaks a sentence and tells the length and the month', async (t) => {
  const { gladys } = await start(t);
  const result = await gladys.fake.action(ACTIONS.TEST_VOICE, { language: 'fr' });
  const text = JSON.stringify(result);
  assert.match(text, /Kore a prononcé 4,1 s d’audio/);
  assert.match(text, /This month: 0.1 min of audio, 1 clips \(free tier\)/);
  const paid = await start(t, { api_key: API_KEY, tier: 'paid' });
  const bill = JSON.stringify(
    await paid.gladys.fake.action(ACTIONS.TEST_VOICE, { language: 'en' }),
  );
  assert.match(bill, /This month: about \$0 of \$2\./);
});

test('list button: your voices, then the catalog voices of a language, free', async (t) => {
  const { api, gladys } = await start(t);
  const result = await gladys.fake.action(ACTIONS.LIST_VOICES, { language: 'fr' });
  const text = JSON.stringify(result);
  assert.match(text, /Your voices \(1\):\\nvoice_abc123 “Butler” \(en-GB\)/);
  assert.match(text, /2 voices of the catalog for “fr”/);
  assert.match(text, /Camille \(fr-FR, female, Warm Parisian narrator\)/);
  assert.match(text, /Lucien \(fr-CA, male\)/);
  assert.equal(synth(api).length, 0);
  const german = JSON.stringify(await gladys.fake.action(ACTIONS.LIST_VOICES, { language: 'it' }));
  assert.match(german, /No voice of the catalog is marked for “it”/);
});

test('the widget is valid in each language, with and without a key', async (t) => {
  const { gladys } = await start(t);
  await gladys.fake.ttsSynthesize('Bonjour', 'fr');
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await gladys.fake.widgetGet(WIDGETS.USAGE, { language });
    assert.equal(ack.success, true);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
    const components = ack.data.content.components;
    assert.equal(components[0].text, 'Kore · Gemini 3.8 Flash-Lite TTS');
    assert.ok(components.some((c) => c.type === 'chart'));
  }
  const { gladys: bare } = await start(t, {});
  const ack = await bare.fake.widgetGet(WIDGETS.USAGE, { language: 'fr' });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.match(JSON.stringify(ack.data.content), /Pas encore de clé/);
});

test('the counters survive a restart', async (t) => {
  const api = await startFakeGemini();
  const dir = await mkdtemp(join(tmpdir(), 'gtts-restart-'));
  t.after(async () => {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  });
  const options = {
    baseUrl: api.url,
    sleep: async () => {},
    usageFile: join(dir, 'usage.json'),
    clipsDir: join(dir, 'clips'),
    now: () => NOW,
  };
  const config = { api_key: API_KEY, tier: 'paid' };
  const first = createFakeGladys({ config });
  const app1 = createApp(first, options);
  await first.connect();
  await app1.whenReady();
  await first.fake.ttsSynthesize('Bonjour', 'fr');
  const spent = app1.usage.used();
  assert.ok(spent > 0);
  await app1.usage.save();
  app1.usage.stop();

  const second = createFakeGladys({ config });
  const app2 = createApp(second, options);
  await second.connect();
  await app2.whenReady();
  assert.equal(app2.usage.used(), spent);
  app2.usage.stop();
});
