import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from '../src/config.js';
import { buildUsageWidget, compact, dollars } from '../src/widgets.js';

const NOW = Date.parse('2026-11-14T10:00:00Z');
const snapshot = (overrides = {}) => ({
  month: {
    characters: 0,
    seconds: 0,
    cost: 0,
    clips: 0,
    cached: 0,
    saved: 0,
    refused: 0,
    by_model: {},
  },
  today: { characters: 0, seconds: 0, clips: 0, cached: 0, errors: 0 },
  days: [],
  last_clip: null,
  last_error: null,
  ...overrides,
});
const statusOf = (content) => content.components.find((c) => c.type === 'status').items;
const busy = snapshot({
  month: { ...snapshot().month, seconds: 754, cost: 1.71, clips: 120, cached: 45 },
  today: { characters: 900, seconds: 64, clips: 12, cached: 4, errors: 1 },
  days: [
    { date: '2026-11-13', seconds: 80 },
    { date: '2026-11-14', seconds: 64 },
  ],
  last_clip: { at: NOW - 120_000, seconds: 4.2, cached: false },
  last_error: { at: NOW - 3_600_000, kind: 'rate_limit' },
});

test('paid tier with a budget: gauge, spending, valid in each language', () => {
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = buildUsageWidget({
      snapshot: busy,
      config: normalizeConfig({ api_key: 'k', tier: 'paid', monthly_budget: '2' }),
      failing: null,
      language,
      now: NOW,
      timeZone: 'Europe/Paris',
    });
    assert.deepEqual(validateWidgetContent(content), [], language);
    assert.ok(content.components.length <= 8);
    assert.equal(content.components[0].text, 'Kore · Gemini 3.8 Flash-Lite TTS');
    const gauge = content.components.find((c) => c.type === 'gauge');
    assert.equal(gauge.value, 85.5);
    assert.equal(gauge.color, 'warning');
    for (const tile of content.components.filter((c) => c.type === 'value')) {
      assert.ok(String(tile.value).length <= 12, `${language}: ${tile.value}`);
    }
    assert.ok(content.components.some((c) => c.type === 'chart'));
  }
});

test('free tier: no gauge, minutes of audio, the tier in the status', () => {
  const content = buildUsageWidget({
    snapshot: busy,
    config: normalizeConfig({ api_key: 'k' }),
    failing: null,
    language: 'fr',
    now: NOW,
    timeZone: 'Europe/Paris',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(
    content.components.some((c) => c.type === 'gauge'),
    false,
  );
  assert.equal(content.components.find((c) => c.type === 'value').value, '12,6 min');
  assert.equal(statusOf(content)[1].value, 'Gratuite');
});

test('states: no key, failing, budget reached', () => {
  const base = { snapshot: snapshot(), language: 'en', now: NOW, timeZone: 'UTC' };
  const noKey = buildUsageWidget({ ...base, config: normalizeConfig(), failing: null });
  assert.deepEqual(validateWidgetContent(noKey), []);
  assert.equal(statusOf(noKey)[0].value, 'No API key');
  const failing = buildUsageWidget({
    ...base,
    config: normalizeConfig({ api_key: 'k' }),
    failing: { kind: 'auth', since: NOW - 60_000 },
  });
  assert.match(statusOf(failing)[0].value, /^Failing since 09:59$/);
  const reached = buildUsageWidget({
    ...base,
    snapshot: snapshot({ month: { ...snapshot().month, cost: 5 } }),
    config: normalizeConfig({ api_key: 'k', tier: 'paid', monthly_budget: '5' }),
    failing: null,
  });
  assert.equal(statusOf(reached)[0].value, 'Monthly budget reached');
  assert.equal(reached.components.find((c) => c.type === 'gauge').color, 'danger');
});

test('short numbers fit a tile', () => {
  assert.equal(compact(950_000, 'en'), '950K');
  assert.equal(dollars(1.714, 'en'), '$1.71');
  assert.equal(dollars(0.42, 'fr').replace(/\s/g, ' '), '0,42 $');
  assert.equal(dollars(25, 'de').replace(/\s/g, ' '), '25 $');
});
