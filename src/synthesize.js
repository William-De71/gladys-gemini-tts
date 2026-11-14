// -----------------------------------------------------------------------------
// The TTS provider: one text in, one clip out.
//
// Contract (SDK README, "Text-to-speech providers"): `text` is at most 2,000
// characters, `language` the user's ("fr", null when unknown); resolve
// `<content type>;base64,<audio>` with a content type of
// TTS_AUDIO_CONTENT_TYPES and at most 5 MB decoded, within 30 s. A throw fails
// the scene action visibly and leaves the assistant reply in text: never a
// silent fallback to another voice.
//
// Gemini TTS detects the language of the text itself: `language` only tells
// the scene events what was asked. Order of a clip: clean the text, build the
// request; a clip already spoken with exactly that request comes from the
// cache (free); otherwise the monthly budget (paid tier) is checked BEFORE
// spending, then Gemini speaks.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { costOf, estimateTokens, monthlyBudget, voiceOf } from './config.js';
import { ERROR_KINDS, GeminiError } from './gemini-api.js';
import { clipKey } from './clip-cache.js';
import { MAX_AUDIO_BYTES, parseWav, toClip } from './audio.js';
import { prepareText } from './text.js';
import { countCharacters } from './usage.js';
import { LIMIT_LEVELS, WARNING_SHARE } from './events.js';

const logger = createLogger({ name: 'tts' });

/** The core waits 30 s for the ack: Gemini gets 26 s, retries included. */
export const SYNTHESIS_TIMEOUT_MS = 26_000;

/**
 * @description The CreateInteraction body of a text.
 * @param {string} text - The cleaned text.
 * @param {object} config - The normalized config.
 * @returns {object} The request body.
 */
export function buildRequest(text, config) {
  const content = { type: 'text', text };
  if (config.style) {
    content.annotations = [{ type: 'speech_metadata', style: config.style }];
  }
  return {
    model: config.model,
    input: [{ type: 'user_input', content: [content] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: config.sample_rate },
    generation_config: { speech_config: [{ voice: voiceOf(config) }] },
    // A notification has no reason to stay stored at Google.
    store: false,
  };
}

/**
 * @description The seconds of a WAV clip.
 * @param {Buffer} wav - The clip.
 * @returns {number} Seconds, 0 when unreadable.
 */
function secondsOf(wav) {
  const parsed = parseWav(wav);
  return parsed ? parsed.pcm.length / 2 / parsed.rate : 0;
}

/**
 * @description Build the synthesis function.
 * @param {object} options - Options.
 * @param {object} options.client - The Gemini client.
 * @param {object} options.cache - The clip cache.
 * @param {object} options.usage - The usage store.
 * @param {() => object} options.getConfig - The normalized config.
 * @param {(error: GeminiError, context: object) => void} [options.onFailure] - After a failure.
 * @param {(clip: object) => void} [options.onSuccess] - After a clip.
 * @param {(level: string, data: object) => void} [options.onLimit] - A level of the budget crossed.
 * @param {() => number} [options.now] - Clock.
 * @returns {(text: string, language: string|null) => Promise<object>} The function.
 */
export function createSynthesizer({
  client,
  cache,
  usage,
  getConfig,
  onFailure = () => {},
  onSuccess = () => {},
  onLimit = () => {},
  now = Date.now,
}) {
  const limitData = (budget) => ({
    used: Math.round(usage.used() * 100) / 100,
    limit: budget,
    month: usage.monthKey(),
  });

  function checkThresholds(config) {
    const budget = monthlyBudget(config);
    if (!Number.isFinite(budget)) {
      return;
    }
    const used = usage.used();
    if (used >= budget) {
      if (usage.markAlert(LIMIT_LEVELS.REACHED)) {
        onLimit(LIMIT_LEVELS.REACHED, limitData(budget));
      }
    } else if (used >= budget * WARNING_SHARE && usage.markAlert(LIMIT_LEVELS.WARNING)) {
      onLimit(LIMIT_LEVELS.WARNING, limitData(budget));
    }
  }

  return async function synthesize(rawText, language) {
    const config = getConfig();
    const started = now();
    const voice = voiceOf(config);
    try {
      if (!config.api_key) {
        throw new GeminiError(ERROR_KINDS.AUTH, 'No Gemini API key in the configuration');
      }
      const text = prepareText(rawText);
      if (!text) {
        throw new GeminiError(ERROR_KINDS.REQUEST, 'Nothing to say once the text is cleaned');
      }
      const request = buildRequest(text, config);
      const characters = countCharacters(text);
      const key = clipKey(request);

      const kept = await cache.get(key);
      if (kept) {
        const length = secondsOf(kept);
        usage.recordCached({ voice, characters, seconds: length });
        logger.debug(`Clip from the cache: ${voice}, ${characters} characters`);
        const clip = { voice, characters, seconds: length, cached: true, ms: now() - started };
        onSuccess(clip);
        return {
          ...clip,
          bytes: kept.length,
          audio: `audio/wav;base64,${kept.toString('base64')}`,
        };
      }

      const paid = config.tier === 'paid';
      const budget = monthlyBudget(config);
      if (Number.isFinite(budget)) {
        const estimate = costOf(estimateTokens(text, config.style), config.model, now());
        if (usage.used() + estimate > budget) {
          usage.recordRefused();
          // "reached" means a clip was refused, even when the counter is a
          // few cents short of the budget.
          if (usage.markAlert(LIMIT_LEVELS.REACHED)) {
            onLimit(LIMIT_LEVELS.REACHED, limitData(budget));
          }
          throw new GeminiError(
            ERROR_KINDS.LIMIT,
            `Monthly budget reached: about $${usage.used().toFixed(2)} of $${budget} spent`,
          );
        }
      }

      const answer = await client.synthesize(request, { timeoutMs: SYNTHESIS_TIMEOUT_MS });
      let clipAudio;
      try {
        clipAudio = toClip(answer.audio, answer.mimeType, config.sample_rate);
      } catch (err) {
        throw new GeminiError(ERROR_KINDS.SERVER, err.message);
      }
      if (clipAudio.wav.length > MAX_AUDIO_BYTES) {
        throw new GeminiError(
          ERROR_KINDS.REQUEST,
          `Clip of ${Math.round(clipAudio.wav.length / 1024)} KB (${Math.round(clipAudio.seconds)} s), over the 5 MB Gladys accepts: shorten the text`,
        );
      }
      const ms = now() - started;
      const cost = paid ? costOf(answer.tokens, config.model, now()) : 0;
      usage.recordClip({
        voice,
        model: config.model,
        characters,
        seconds: clipAudio.seconds,
        tokens: answer.tokens,
        cost,
        ms,
      });
      logger.info(
        `Clip spoken: ${voice}, ${characters} characters, ${clipAudio.seconds.toFixed(1)} s of audio` +
          `${clipAudio.resampled ? ' (resampled to 16 kHz)' : ''}, ${ms} ms`,
      );
      checkThresholds(config);
      // The cache never delays the clip, and never fails it.
      cache.put(key, clipAudio.wav).catch(() => {});
      const clip = { voice, characters, seconds: clipAudio.seconds, cached: false, ms, cost };
      onSuccess(clip);
      return {
        ...clip,
        bytes: clipAudio.wav.length,
        audio: `audio/wav;base64,${clipAudio.wav.toString('base64')}`,
      };
    } catch (err) {
      const error =
        err instanceof GeminiError
          ? err
          : new GeminiError(ERROR_KINDS.SERVER, String(err?.message ?? err));
      if (error.kind !== ERROR_KINDS.LIMIT) {
        usage.recordError({ kind: error.kind, message: error.message, voice });
      }
      logger.warn(`Clip failed (${error.kind}): ${error.message}`);
      onFailure(error, { voice, language: language ?? null });
      throw error;
    }
  };
}
