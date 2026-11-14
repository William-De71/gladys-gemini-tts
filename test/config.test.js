import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  costOf,
  DEFAULT_CONFIG,
  estimateTokens,
  monthlyBudget,
  normalizeConfig,
  pricesOf,
  voiceOf,
} from '../src/config.js';

test('defaults fill an empty or broken configuration, numbers from the selects', () => {
  const empty = normalizeConfig();
  assert.equal(empty.model, 'gemini-3.8-flash-lite-tts');
  assert.equal(empty.voice, 'Kore');
  assert.equal(empty.sample_rate, 24000);
  assert.equal(empty.tier, 'free');
  assert.equal(empty.monthly_budget, 2);
  assert.deepEqual(normalizeConfig(null), empty);
  const config = normalizeConfig({
    api_key: '  AIzaKey  ',
    model: 'gemini-2.5-flash-preview-tts',
    voice: 'Robot',
    custom_voice: 'not a voice!!',
    style: '  calm\n and   warm  ',
    sample_rate: '8000',
    tier: 'gold',
    monthly_budget: '3',
  });
  assert.equal(config.api_key, 'AIzaKey');
  assert.equal(config.model, DEFAULT_CONFIG.model, 'an unknown model falls back');
  assert.equal(config.voice, 'Kore');
  assert.equal(config.custom_voice, '');
  assert.equal(config.style, 'calm and warm');
  assert.equal(config.sample_rate, 24000);
  assert.equal(config.tier, 'free');
  assert.equal(config.monthly_budget, 2);
  assert.equal(normalizeConfig({ style: 'x'.repeat(500) }).style.length, 200);
});

test('the voice: a custom one wins', () => {
  assert.equal(voiceOf(normalizeConfig({ voice: 'Puck' })), 'Puck');
  assert.equal(voiceOf(normalizeConfig({ custom_voice: ' voice_abc123 ' })), 'voice_abc123');
  assert.equal(voiceOf(normalizeConfig({ custom_voice: 'Camille' })), 'Camille');
  assert.equal(
    voiceOf(normalizeConfig({ custom_voice: 'voicekey_0123456789abcdef' })),
    'voicekey_0123456789abcdef',
  );
});

test('budget only on the paid tier; prices double in 2027', () => {
  assert.equal(monthlyBudget(normalizeConfig()), Infinity);
  assert.equal(monthlyBudget(normalizeConfig({ tier: 'paid' })), 2);
  assert.equal(monthlyBudget(normalizeConfig({ tier: 'paid', monthly_budget: '0' })), Infinity);
  const before = Date.parse('2026-12-31T12:00:00Z');
  const after = Date.parse('2027-01-01T09:00:00Z');
  assert.deepEqual(pricesOf('gemini-3.8-flash-tts', before), { input: 0.5, output: 9 });
  assert.deepEqual(pricesOf('gemini-3.8-flash-tts', after), { input: 1, output: 18 });
  // 10 s of audio on Flash-Lite: 250 tokens at $6 / M = $0.0015, as the pricing page says.
  assert.equal(costOf({ output: 250 }, 'gemini-3.8-flash-lite-tts', before), 0.0015);
  const estimate = estimateTokens('x'.repeat(120));
  assert.deepEqual(estimate, { input: 40, output: 275 });
});
