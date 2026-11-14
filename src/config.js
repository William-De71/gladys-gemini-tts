// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the administrator in Gladys from the `config_schema` of the
// manifest; the SDK fetches it (`gladys.getConfig()`) and notifies every
// change (`gladys.onConfigUpdated()`). This module provides the defaults and
// normalizes what arrives, so the rest of the code never deals with
// `undefined`, a number typed as a string, or a value the select no longer
// offers.
// -----------------------------------------------------------------------------

/**
 * The Gemini TTS models offered (ai.google.dev speech-generation and pricing
 * pages, checked 2026-11-14). Both detect the language of the text on their
 * own and share the same voices. `input` / `output`: US dollars per million
 * tokens on the paid tier, before and from the price change of 2027-01-01
 * (text in, audio out; 25 audio tokens per second). The free tier costs
 * nothing, but Google may use what it receives to improve its products. The
 * keys are stored by users: a model leaves this list only when Google shuts
 * it down.
 */
export const MODELS = {
  'gemini-3.8-flash-lite-tts': {
    name: 'Gemini 3.8 Flash-Lite TTS',
    input: [0.5, 1],
    output: [6, 12],
  },
  'gemini-3.8-flash-tts': {
    name: 'Gemini 3.8 Flash TTS',
    input: [0.5, 1],
    output: [9, 18],
  },
};

/** Paid prices double from this instant (midnight Pacific, like Google bills). */
export const PRICE_CHANGE_AT = Date.parse('2027-01-01T08:00:00Z');

/** Audio tokens billed per second of speech. */
export const AUDIO_TOKENS_PER_SECOND = 25;

/**
 * The 30 prebuilt studio voices, with the character Google gives them. They
 * speak every language of the model. More voices (the Extended Voice Library,
 * or a voice designed in AI Studio) are typed in `custom_voice`.
 */
export const VOICES = {
  Zephyr: 'bright',
  Puck: 'upbeat',
  Charon: 'informative',
  Kore: 'firm',
  Fenrir: 'excitable',
  Leda: 'youthful',
  Orus: 'firm',
  Aoede: 'breezy',
  Callirrhoe: 'easy-going',
  Autonoe: 'bright',
  Enceladus: 'breathy',
  Iapetus: 'clear',
  Umbriel: 'easy-going',
  Algieba: 'smooth',
  Despina: 'smooth',
  Erinome: 'clear',
  Algenib: 'gravelly',
  Rasalgethi: 'informative',
  Laomedeia: 'upbeat',
  Achernar: 'soft',
  Alnilam: 'firm',
  Schedar: 'even',
  Gacrux: 'mature',
  Pulcherrima: 'forward',
  Achird: 'friendly',
  Zubenelgenubi: 'casual',
  Vindemiatrix: 'gentle',
  Sadachbia: 'lively',
  Sadaltager: 'knowledgeable',
  Sulafat: 'warm',
};

/**
 * A voice typed by hand: a voice of the Extended Voice Library (a name like
 * `Kore`, letters only), a stored custom voice (`voice_…`) or a stateless
 * replicated voice key (`voicekey_…`, 7 days).
 */
export const CUSTOM_VOICE_PATTERN =
  /^(?:voice_[A-Za-z0-9_-]{4,200}|voicekey_[A-Za-z0-9_-]{4,400}|[A-Za-z][A-Za-z0-9 _.'-]{1,60})$/;

/** The sample rates offered: 16 kHz halves the size of a long clip. */
export const SAMPLE_RATES = ['24000', '16000'];

/** Free tier (no bill, a daily quota) or paid tier (a bill, the budget below). */
export const TIERS = ['free', 'paid'];

/** The monthly budgets offered, in US dollars; '0' = no budget. */
export const BUDGETS = ['0', '0.5', '1', '2', '5', '10', '20', '50'];

/** The languages of the button forms. */
export const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'nl', 'pt'];

/** The longest style kept (it is sent with every clip). */
export const MAX_STYLE = 200;

// Defaults: they MUST stay consistent with the `default` values declared in
// the `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // The Gemini API key (Google AI Studio). A `secret` field: never logged.
  api_key: '',
  model: 'gemini-3.8-flash-lite-tts',
  voice: 'Kore',
  // A voice by name or id, replacing `voice` when set.
  custom_voice: '',
  // How the voice speaks, in a few words ("calm and warm"): every clip.
  style: '',
  sample_rate: '24000',
  tier: 'free',
  // US dollars a month on the paid tier; '0' = no budget.
  monthly_budget: '2',
};

/**
 * @description Merge the user config with the defaults.
 * @param {Record<string, unknown>} [raw] - Config returned by the SDK.
 * @returns {object} The normalized config.
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const pick = (key, allowed) =>
    allowed.includes(String(config[key])) ? String(config[key]) : DEFAULT_CONFIG[key];
  const custom = String(config.custom_voice ?? '').trim();
  return {
    api_key: String(config.api_key ?? '').trim(),
    model: config.model in MODELS ? config.model : DEFAULT_CONFIG.model,
    voice: config.voice in VOICES ? config.voice : DEFAULT_CONFIG.voice,
    custom_voice: CUSTOM_VOICE_PATTERN.test(custom) ? custom : '',
    style: cleanStyle(config.style),
    sample_rate: Number(pick('sample_rate', SAMPLE_RATES)),
    tier: pick('tier', TIERS),
    monthly_budget: Number(pick('monthly_budget', BUDGETS)),
  };
}

/**
 * @description The style sent with each clip: one line, short.
 * @param {unknown} value - What was typed.
 * @returns {string} The style, '' when none.
 */
export function cleanStyle(value) {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return [...text].slice(0, MAX_STYLE).join('').trim();
}

/**
 * @description The voice that speaks.
 * @param {object} config - The normalized config.
 * @returns {string} `Kore`, `voice_abc…`.
 */
export function voiceOf(config) {
  return config.custom_voice || config.voice;
}

/**
 * @description The budget of the month, in US dollars.
 * @param {object} config - The normalized config.
 * @returns {number} The budget, Infinity when none (free tier or '0').
 */
export function monthlyBudget(config) {
  if (config.tier !== 'paid' || !(config.monthly_budget > 0)) {
    return Infinity;
  }
  return config.monthly_budget;
}

/**
 * @description The prices of a model at an instant.
 * @param {string} model - A MODELS key.
 * @param {number} at - The instant (ms).
 * @returns {{ input: number, output: number }} US dollars per million tokens.
 */
export function pricesOf(model, at) {
  const entry = MODELS[model] ?? MODELS[DEFAULT_CONFIG.model];
  const index = at >= PRICE_CHANGE_AT ? 1 : 0;
  return { input: entry.input[index], output: entry.output[index] };
}

/**
 * @description What a clip costs on the paid tier.
 * @param {object} tokens - `{ input, output }` tokens.
 * @param {string} model - A MODELS key.
 * @param {number} at - The instant (ms).
 * @returns {number} US dollars.
 */
export function costOf({ input = 0, output = 0 }, model, at) {
  const prices = pricesOf(model, at);
  return (input * prices.input + output * prices.output) / 1_000_000;
}

/** Characters spoken per second, a little fast on purpose (the estimate errs high). */
const CHARACTERS_PER_SECOND = 12;

/**
 * @description The tokens a text will probably cost, before asking Google:
 * about 4 characters per text token, 12 characters per second of speech.
 * @param {string} text - The text sent.
 * @param {string} style - The style sent.
 * @returns {{ input: number, output: number }} Tokens.
 */
export function estimateTokens(text, style = '') {
  const characters = [...String(text ?? '')].length;
  return {
    input: Math.ceil((characters + [...String(style ?? '')].length) / 4) + 10,
    output: Math.ceil((characters / CHARACTERS_PER_SECOND) * AUDIO_TOKENS_PER_SECOND) + 25,
  };
}
