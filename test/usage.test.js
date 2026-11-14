import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countCharacters, createUsage } from '../src/usage.js';

const temp = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'gtts-usage-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'usage.json');
};

const clip = (overrides = {}) => ({
  voice: 'Kore',
  model: 'gemini-3.8-flash-lite-tts',
  characters: 100,
  seconds: 7.5,
  tokens: { input: 25, output: 188 },
  cost: 0.001141,
  ms: 900,
  ...overrides,
});

test('characters are code points', () => {
  assert.equal(countCharacters('Café'), 4);
  assert.equal(countCharacters('日本語'), 3);
});

test('the billing month is Pacific time; the days are local to Gladys', async (t) => {
  // 2026-12-01 06:30 UTC: already December in Paris, still November in California.
  let clock = Date.parse('2026-12-01T06:30:00Z');
  const usage = createUsage({
    file: await temp(t),
    now: () => clock,
    timeZone: () => 'Europe/Paris',
  });
  usage.recordClip(clip());
  assert.equal(usage.monthKey(), '2026-11');
  assert.equal(usage.used(), 0.001141);
  assert.equal(usage.snapshot().today.seconds, 7.5);
  assert.deepEqual(usage.snapshot().days, [{ date: '2026-12-01', seconds: 7.5 }]);
  clock = Date.parse('2026-12-01T09:00:00Z');
  assert.equal(usage.monthKey(), '2026-12');
  assert.equal(usage.used(), 0, 'a new billing month starts empty');
  usage.stop();
});

test('cache hits are free, refusals and errors are counted apart, alerts once a month', async (t) => {
  const clock = Date.parse('2026-11-14T10:00:00Z');
  const usage = createUsage({ file: await temp(t), now: () => clock, timeZone: () => 'UTC' });
  usage.recordClip(clip());
  usage.recordClip(clip({ seconds: 2.5, cost: 0.0004 }));
  usage.recordCached({ voice: 'Kore', characters: 40, seconds: 3 });
  usage.recordRefused();
  usage.recordError({ kind: 'server', message: 'x'.repeat(500), voice: 'Kore' });
  const { month, today, last_error: error, last_clip: last } = usage.snapshot();
  assert.equal(usage.used(), 0.001541);
  assert.deepEqual(
    [month.clips, month.cached, month.saved, month.refused, month.seconds],
    [2, 1, 3, 1, 10],
  );
  assert.deepEqual([month.input_tokens, month.output_tokens], [50, 376]);
  assert.deepEqual(month.by_model, { 'gemini-3.8-flash-lite-tts': 2 });
  assert.equal(today.errors, 1);
  assert.equal(error.message.length, 200);
  assert.equal(last.cached, true);
  assert.equal(usage.markAlert('warning'), true);
  assert.equal(usage.markAlert('warning'), false);
  assert.equal(usage.markAlert('reached'), true);
  usage.stop();
});

test('saved and read back; a broken file starts empty', async (t) => {
  const file = await temp(t);
  const now = () => Date.parse('2026-11-14T10:00:00Z');
  const first = createUsage({ file, now });
  first.recordClip(clip({ cost: 0.25 }));
  await first.save();
  const second = createUsage({ file, now });
  await second.load();
  assert.equal(second.used(), 0.25);
  assert.ok(JSON.parse(await readFile(file, 'utf8')).months['2026-11']);
  await writeFile(file, '{oops');
  const third = createUsage({ file, now });
  await third.load();
  assert.equal(third.used(), 0);
  for (const usage of [first, second, third]) usage.stop();
});
