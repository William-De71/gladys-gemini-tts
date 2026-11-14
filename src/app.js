// -----------------------------------------------------------------------------
// SDK wiring: every handler of the integration, registered on the Gladys
// client given, before `connect()`. Kept out of index.js so the tests run it
// against the fake Gladys of the SDK (`createFakeGladys`) and a fake Gemini
// API.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MODELS, monthlyBudget, normalizeConfig, voiceOf } from './config.js';
import { createGeminiClient, DEFAULT_BASE_URL, ERROR_KINDS } from './gemini-api.js';
import { CLIPS_DIR, createClipCache } from './clip-cache.js';
import { createSynthesizer } from './synthesize.js';
import { createEvents } from './events.js';
import { createUsage, USAGE_FILE } from './usage.js';
import { buildUsageWidget, WIDGETS } from './widgets.js';
import {
  checkConnection,
  createCatalog,
  failureMessage,
  listVoices,
  testVoice,
} from './connection.js';
import { all } from './i18n.js';
import { usableTimeZone } from './time.js';

const logger = createLogger({ name: 'app' });

/** Keys of the manifest `actions`: stored by users, forever. */
export const ACTIONS = {
  TEST_VOICE: 'test_voice',
  LIST_VOICES: 'list_voices',
  CLEAR_CACHE: 'clear_cache',
};

/** A widget is nudged at most this often after clips (the core allows 1 / 10 s). */
const WIDGET_NUDGE_MS = 30_000;

/**
 * @description Register the handlers on a Gladys client, before `connect()`.
 * @param {object} gladys - A `GladysIntegration` (or the fake one of the SDK).
 * @param {object} [options] - Test seams.
 * @param {string} [options.baseUrl] - The Gemini API root.
 * @param {typeof fetch} [options.fetchImpl] - fetch.
 * @param {(ms: number) => Promise<void>} [options.sleep] - Retry waits.
 * @param {string} [options.usageFile] - The usage file.
 * @param {string} [options.clipsDir] - The clip cache folder.
 * @param {() => number} [options.now] - Clock.
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @returns {object} Handles for the tests.
 */
export function createApp(
  gladys,
  {
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    sleep,
    usageFile = USAGE_FILE,
    clipsDir = CLIPS_DIR,
    now = Date.now,
    timeZone = usableTimeZone(),
  } = {},
) {
  let config = normalizeConfig();
  const getConfig = () => config;

  const client = createGeminiClient({
    getApiKey: () => config.api_key,
    baseUrl,
    fetchImpl,
    sleep,
    now,
  });
  const catalog = createCatalog(client, now);
  const cache = createClipCache({
    dir: clipsDir,
    now,
    onError: (err) => logger.warn(`Clip cache: ${err?.message ?? err}`),
  });
  const usage = createUsage({
    file: usageFile,
    now,
    timeZone: () => timeZone,
    onError: (err) => logger.warn(`Usage counters not saved: ${err?.message ?? err}`),
  });
  const events = createEvents({ publish: (key, data) => gladys.publishSceneEvent(key, data), now });

  // --- Widget nudges ----------------------------------------------------------
  let lastNudge = 0;
  const nudgeWidget = () => {
    if (now() - lastNudge < WIDGET_NUDGE_MS) {
      return;
    }
    lastNudge = now();
    Promise.resolve()
      .then(() => gladys.requestWidgetRefresh(WIDGETS.USAGE))
      .catch(() => {});
  };

  // --- Status follows the clips -------------------------------------------------
  // A failing provider shows on the Configuration screen; the next clip clears
  // it. A refused text says nothing about the provider.
  const setStatus = (ok, message) =>
    Promise.resolve()
      .then(() => gladys.setConnectionStatus(ok, ok ? undefined : message))
      .catch((err) => logger.warn(`Status not updated: ${err?.message ?? err}`));

  let limitShown = false;
  const synthesize = createSynthesizer({
    client,
    cache,
    usage,
    getConfig,
    now,
    onFailure: (error, context) => {
      const wasFailing = events.state();
      events.failure(error, context);
      if (error.kind === ERROR_KINDS.LIMIT && !limitShown) {
        limitShown = true;
        setStatus(false, failureMessage(error, config));
      } else if (error.kind !== ERROR_KINDS.REQUEST && error.kind !== ERROR_KINDS.LIMIT) {
        if (events.state() !== wasFailing) {
          setStatus(false, failureMessage(error, config));
        }
      }
      nudgeWidget();
    },
    onSuccess: () => {
      if (events.state() || limitShown) {
        limitShown = false;
        setStatus(true);
      }
      events.success();
      nudgeWidget();
    },
    onLimit: (level, data) => {
      logger.warn(`Monthly budget ${level}: about $${data.used} of $${data.limit}`);
      events.limit(level, data);
    },
  });

  // --- TTS provider: every clip of the instance arrives here ---------------------
  gladys.onTtsSynthesize(async (text, language) => {
    const clip = await synthesize(text, language);
    return clip.audio;
  });

  // --- Configuration buttons -------------------------------------------------------
  gladys.onAction(ACTIONS.TEST_VOICE, async (fields = {}) => {
    logger.info('Action test_voice');
    return testVoice(synthesize, usage, config, fields);
  });
  gladys.onAction(ACTIONS.LIST_VOICES, async (fields = {}) => {
    logger.info('Action list_voices');
    return listVoices(catalog, config, fields);
  });
  gladys.onAction(ACTIONS.CLEAR_CACHE, async () => {
    logger.info('Action clear_cache');
    const count = await cache.clear();
    return all('cacheCleared', { count });
  });

  // --- Dashboard widget ------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.USAGE, async ({ language } = {}) =>
    buildUsageWidget({
      snapshot: usage.snapshot(),
      config,
      failing: events.state(),
      language,
      now: now(),
      timeZone,
    }),
  );

  // --- Configuration ---------------------------------------------------------------
  async function applyConfig(raw) {
    const previousKey = config.api_key;
    config = normalizeConfig(raw);
    if (config.api_key !== previousKey) {
      // Another key may belong to another project, with other custom voices.
      catalog.clear();
    }
    const budget = monthlyBudget(config);
    logger.info(
      `Configuration: ${MODELS[config.model].name}, voice ${voiceOf(config)}, ` +
        `style ${config.style ? 'set' : 'none'}, ${config.sample_rate} Hz, ${config.tier} tier, ` +
        `budget ${Number.isFinite(budget) ? `$${budget}` : 'none'}, ` +
        `API key ${config.api_key ? 'set' : 'missing'}`,
    );
    const { ok, message, warnings } = await checkConnection(client, config);
    for (const warning of warnings) {
      logger.warn(warning.en);
    }
    limitShown = false;
    await setStatus(ok, message);
    nudgeWidget();
  }

  gladys.onConfigUpdated(async (raw) => {
    await applyConfig(raw);
  });

  // Each (re)connection re-reads the configuration, which may have changed
  // while the integration was away. The promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await usage.load();
      await applyConfig(await gladys.getConfig());
    })().catch(async (err) => {
      logger.error('Post-connection initialization failed', err);
      await setStatus(false, all('statusInitFailed'));
    });
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    await usage.save().catch(() => {});
    usage.stop();
  });

  return { getConfig, usage, events, client, catalog, cache, synthesize, whenReady: () => startup };
}
