// -----------------------------------------------------------------------------
// Connection status and the buttons of the Configuration screen.
//
// The status says whether Gemini can speak: a key is there and Google accepts
// it (listing the voice catalog proves it without generating anything), and
// a voice typed by hand exists. It does not prove the quota or the credit
// left: only "Test the voice" tells, by speaking a short sentence on purpose.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MODELS, monthlyBudget } from './config.js';
import { ERROR_KINDS, GeminiError } from './gemini-api.js';
import { all, formatNumber, t } from './i18n.js';

const logger = createLogger({ name: 'connection' });

/** Voices listed by the "List the voices" button, at most. */
const LIST_MAX = 40;

/** The catalog is kept this long: listing is free but slow. */
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

/** The test sentence of the languages the runtime texts do not cover. */
const MORE_SENTENCES = {
  it: 'Ciao, sono la voce di Gladys. A casa va tutto bene.',
  nl: 'Hallo, ik ben de stem van Gladys. Thuis is alles in orde.',
  pt: 'Olá, sou a voz da Gladys. Está tudo bem em casa.',
};

/**
 * @description The test sentence of a language.
 * @param {string} language - "fr", "it".
 * @returns {string} The sentence.
 */
export function testSentence(language) {
  return MORE_SENTENCES[language] ?? t('testSentence', language);
}

/**
 * @description The localized reason of a failure.
 * @param {unknown} err - The error.
 * @param {object} [config] - The normalized config (the model named).
 * @returns {object} `{ en, fr, de, es }`.
 */
export function failureMessage(err, config = {}) {
  const kind = err instanceof GeminiError ? err.kind : ERROR_KINDS.SERVER;
  switch (kind) {
    case ERROR_KINDS.AUTH:
      return all('statusBadKey');
    case ERROR_KINDS.DISABLED:
      return all('statusDisabled');
    case ERROR_KINDS.BILLING:
      return all('statusBilling');
    case ERROR_KINDS.QUOTA:
      return all('statusQuota');
    case ERROR_KINDS.MODEL:
      return all('statusModel', { model: MODELS[config.model]?.name ?? config.model ?? '' });
    case ERROR_KINDS.VOICE:
      return all('statusNoVoice', { detail: err?.message ?? '' });
    case ERROR_KINDS.RATE_LIMIT:
      return all('statusRateLimited');
    case ERROR_KINDS.LIMIT:
      return all('statusLimit');
    case ERROR_KINDS.UNREACHABLE:
    case ERROR_KINDS.TIMEOUT:
      return all('statusUnreachable');
    default:
      return all('statusApiError', { detail: err?.message ?? String(err) });
  }
}

/**
 * @description The voice catalog, kept a day.
 * @param {object} client - The Gemini client.
 * @param {() => number} [now] - Clock.
 * @returns {{ list: () => Promise<Array<object>>, clear: () => void }} The catalog.
 */
export function createCatalog(client, now = Date.now) {
  let kept = null;
  return {
    async list() {
      if (kept && now() - kept.at < CATALOG_TTL_MS) {
        return kept.voices;
      }
      const voices = await client.listVoices();
      kept = { at: now(), voices };
      return voices;
    },
    clear() {
      kept = null;
    },
  };
}

/**
 * @description Check the configuration against Google, without generating
 * anything.
 * @param {object} client - The Gemini client.
 * @param {object} config - The normalized config.
 * @returns {Promise<{ ok: boolean, message?: object, warnings: Array<object> }>} The result.
 */
export async function checkConnection(client, config) {
  if (!config.api_key) {
    return { ok: false, message: all('statusNoKey'), warnings: [] };
  }
  const warnings = [];
  try {
    // One voice listed proves the key and the API.
    await client.listVoices({}, { pageSize: 1, timeoutMs: 15_000 });
    const custom = config.custom_voice;
    if (custom.startsWith('voicekey_')) {
      warnings.push(all('warnVoiceKey', { voice: custom.slice(0, 20) }));
    } else if (custom.startsWith('voice_')) {
      try {
        await client.getVoice(custom, { timeoutMs: 15_000 });
      } catch (err) {
        if (err?.status !== 404) {
          throw err;
        }
        warnings.push(all('warnUnknownVoice', { voice: custom }));
      }
    } else if (custom) {
      const voices = await client.listVoices({}, { timeoutMs: 15_000 });
      if (!voices.some((voice) => voice.id === custom || voice.name === custom)) {
        warnings.push(all('warnUnknownVoice', { voice: custom }));
      }
    }
  } catch (err) {
    logger.warn(`Connection check failed: ${err?.message ?? err}`);
    return { ok: false, message: failureMessage(err, config), warnings };
  }
  return { ok: true, warnings };
}

/**
 * @description The "Test the voice" action: one short real clip.
 * @param {Function} synthesize - The synthesis function.
 * @param {object} usage - The usage store.
 * @param {object} config - The normalized config.
 * @param {{ language?: string, text?: string }} fields - The form.
 * @returns {Promise<object>} The message shown under the button.
 */
export async function testVoice(synthesize, usage, config, fields = {}) {
  if (!config.api_key) {
    return all('statusNoKey');
  }
  const language = typeof fields.language === 'string' && fields.language ? fields.language : 'en';
  const typed = typeof fields.text === 'string' ? fields.text.trim().slice(0, 300) : '';
  try {
    const clip = await synthesize(typed || testSentence(language), language);
    const month = usage.snapshot().month;
    const budget = monthlyBudget(config);
    return all((lang) =>
      [
        t(clip.cached ? 'testCached' : 'testSpoken', lang, {
          voice: clip.voice,
          seconds: formatNumber(clip.seconds, lang, 1),
          time: formatNumber(clip.ms / 1000, lang, 1),
          kb: formatNumber(clip.bytes / 1024, lang, 0),
        }),
        config.tier === 'paid'
          ? t('testMonthPaid', lang, {
              used: formatNumber(usage.used(), lang, 2),
              budget: Number.isFinite(budget) ? formatNumber(budget, lang, 2) : '–',
            })
          : t('testMonthFree', lang, {
              minutes: formatNumber(month.seconds / 60, lang, 1),
              clips: formatNumber(month.clips, lang, 0),
            }),
      ].join('\n'),
    );
  } catch (err) {
    return failureMessage(err, config);
  }
}

/**
 * @description Whether a voice of the catalog is marked for a language.
 * @param {object} voice - A catalog voice.
 * @param {string} base - "fr".
 * @returns {boolean} True when its language code starts with it.
 */
function speaks(voice, base) {
  return voice.language.toLowerCase().split(/[-_]/)[0] === base;
}

/**
 * @description The "List the voices" action: your voices, then the catalog
 * voices marked for a language.
 * @param {object} catalog - The voice catalog.
 * @param {object} config - The normalized config.
 * @param {{ language?: string }} fields - The form.
 * @returns {Promise<object>} The message shown under the button.
 */
export async function listVoices(catalog, config, fields = {}) {
  if (!config.api_key) {
    return all('statusNoKey');
  }
  const base = (typeof fields.language === 'string' && fields.language) || 'en';
  try {
    const voices = await catalog.list();
    const custom = voices.filter((voice) => voice.type !== 'prebuilt');
    const marked = voices
      .filter((voice) => voice.type === 'prebuilt' && speaks(voice, base))
      .sort((a, b) => a.name.localeCompare(b.name));
    const line = (voice, language) => {
      const parts = [voice.id];
      if (voice.name && voice.name !== voice.id) {
        parts.push(`“${voice.name}”`);
      }
      const details = [];
      if (voice.language) {
        details.push(voice.language);
      }
      if (['female', 'male', 'neutral'].includes(voice.gender)) {
        details.push(t(`gender_${voice.gender}`, language));
      }
      if (voice.description) {
        details.push(voice.description.slice(0, 60));
      }
      return `${parts.join(' ')}${details.length ? ` (${details.join(', ')})` : ''}`;
    };
    return all((language) => {
      const lines = [];
      if (custom.length > 0) {
        lines.push(t('listHeaderCustom', language, { count: custom.length }));
        custom.slice(0, 10).forEach((voice) => lines.push(line(voice, language)));
      }
      if (marked.length === 0) {
        lines.push(t('listNone', language, { language: base }));
      } else {
        lines.push(t('listHeader', language, { count: marked.length, language: base }));
        marked.slice(0, LIST_MAX).forEach((voice) => lines.push(line(voice, language)));
        if (marked.length > LIST_MAX) {
          lines.push(t('listMore', language, { count: marked.length - LIST_MAX }));
        }
      }
      lines.push(t('listHint', language));
      return lines.join('\n');
    });
  } catch (err) {
    return failureMessage(err, config);
  }
}
