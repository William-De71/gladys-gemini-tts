// -----------------------------------------------------------------------------
// Client of the Gemini API (generativelanguage.googleapis.com/v1beta), with
// the administrator's own API key (Google AI Studio).
//
// Plain fetch, no Google library: three endpoints only —
//   - POST /v1beta/interactions       one clip (a TTS model, audio out)
//   - GET  /v1beta/voices             the voice catalog (nothing billed)
//   - GET  /v1beta/voices/{id}        one custom voice (nothing billed)
//
// The key travels in the `x-goog-api-key` header, never in a URL nor a log.
// Every call runs under a deadline. A 429 per minute, a 5xx or a network
// failure is retried while the deadline leaves room for it; a daily quota and
// anything else fail at once with a GeminiError whose `kind` says what went
// wrong.
//
// Two error shapes reach us: the Interactions API documents
// `{ error: { code: "invalid_request", message } }`, while the Google front
// end answers a bad key with the classic `[{ error: { code: 400, status,
// details: [ErrorInfo] } }]` — inside an array (seen on 2026-11-14).
// -----------------------------------------------------------------------------

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** The error kinds, also the `kind` variable of the `error` scene trigger. */
export const ERROR_KINDS = {
  AUTH: 'auth',
  DISABLED: 'disabled',
  BILLING: 'billing',
  QUOTA: 'quota',
  RATE_LIMIT: 'rate_limit',
  MODEL: 'model',
  VOICE: 'voice',
  LIMIT: 'limit',
  REQUEST: 'request',
  SERVER: 'server',
  UNREACHABLE: 'unreachable',
  TIMEOUT: 'timeout',
};

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 4000;
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 20_000;

export class GeminiError extends Error {
  /**
   * @param {string} kind - One of ERROR_KINDS.
   * @param {string} message - What went wrong (never the key).
   * @param {object} [details] - `{ status, code }`.
   */
  constructor(kind, message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/**
 * @description The `error` object of a body, whatever its shape.
 * @param {unknown} body - The parsed body.
 * @returns {object|null} The error object.
 */
export function errorOf(body) {
  const node = Array.isArray(body) ? body[0] : body;
  return node && typeof node === 'object' && node.error && typeof node.error === 'object'
    ? node.error
    : null;
}

/**
 * @description The `reason` of the ErrorInfo detail of a Google error body.
 * @param {unknown} body - The parsed body.
 * @returns {string} `API_KEY_INVALID`, `SERVICE_DISABLED`…, or ''.
 */
export function reasonOf(body) {
  const details = errorOf(body)?.details;
  if (!Array.isArray(details)) {
    return '';
  }
  const info = details.find((detail) => typeof detail?.reason === 'string');
  return info ? info.reason : '';
}

/**
 * @description The machine code of an error: the Interactions `code`
 * (`quota_exceeded`) or the Google `status` (`RESOURCE_EXHAUSTED`).
 * @param {unknown} body - The parsed body.
 * @returns {string} The code, lowercase, or ''.
 */
export function codeOf(body) {
  const error = errorOf(body);
  if (typeof error?.code === 'string') {
    return error.code.toLowerCase();
  }
  return typeof error?.status === 'string' ? error.status.toLowerCase() : '';
}

/** Codes of a text the model refused to speak (policy, safety, language). */
const BLOCKED = new Set([
  'safety',
  'recitation',
  'language',
  'prohibited_content',
  'spii',
  'blocklist',
  'content_blocked',
]);

/**
 * @description The kind of an HTTP failure.
 * @param {number} status - The HTTP status.
 * @param {unknown} [body] - The parsed body.
 * @returns {string} One of ERROR_KINDS.
 */
export function kindOfStatus(status, body = null) {
  const reason = reasonOf(body);
  const code = codeOf(body);
  const message = String(errorOf(body)?.message ?? '');
  if (
    reason === 'API_KEY_INVALID' ||
    reason === 'API_KEY_EXPIRED' ||
    code === 'authentication' ||
    status === 401
  ) {
    return ERROR_KINDS.AUTH;
  }
  if (reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(message)) {
    return ERROR_KINDS.DISABLED;
  }
  if (
    status === 402 ||
    code === 'payment_required' ||
    code === 'failed_precondition' ||
    reason === 'BILLING_DISABLED' ||
    /billing|prepay|credit balance/i.test(message)
  ) {
    return ERROR_KINDS.BILLING;
  }
  if (status === 429) {
    // A daily quota (the free tier) does not come back within a clip.
    return code === 'quota_exceeded' || /per[ _-]?day|daily|PerDay/i.test(message)
      ? ERROR_KINDS.QUOTA
      : ERROR_KINDS.RATE_LIMIT;
  }
  if (code === 'model_not_found' || (status === 404 && /model/i.test(message))) {
    return ERROR_KINDS.MODEL;
  }
  if (
    /voice/i.test(message) &&
    /(not exist|not found|invalid|unknown|not available|unsupported|expired)/i.test(message)
  ) {
    return ERROR_KINDS.VOICE;
  }
  if (BLOCKED.has(code)) {
    return ERROR_KINDS.REQUEST;
  }
  if (status === 403) {
    // A key restricted to other APIs or addresses, a country where the
    // Gemini API is not offered, a project restricted by Google.
    return ERROR_KINDS.AUTH;
  }
  if (status >= 500) {
    return ERROR_KINDS.SERVER;
  }
  return ERROR_KINDS.REQUEST;
}

/**
 * @description Hide anything that looks like a Google API key.
 * @param {string} text - A message.
 * @returns {string} The message without keys.
 */
export function maskKeys(text) {
  return String(text ?? '').replace(/AIza[0-9A-Za-z_-]{10,}/g, 'AIza…');
}

/**
 * @description The message of an error body, short and without secrets.
 * @param {unknown} body - The parsed body, or the raw text.
 * @returns {string} The message.
 */
export function errorMessageOf(body) {
  const message = typeof body === 'string' ? body : String(errorOf(body)?.message ?? '');
  return maskKeys(message.replace(/\s+/g, ' ').trim()).slice(0, 300);
}

/**
 * @description The audio and the tokens of an interaction.
 * @param {object} body - The Interaction resource.
 * @returns {{ audio: Buffer, mimeType: string, tokens: { input: number, output: number } }} The clip.
 */
export function audioOf(body) {
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  let found = null;
  for (const step of steps) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) {
      continue;
    }
    for (const part of step.content) {
      if (part?.type === 'audio' && typeof part.data === 'string' && part.data) {
        found = part;
      }
    }
  }
  if (!found) {
    const status = typeof body?.status === 'string' ? body.status : 'unknown';
    throw new GeminiError(
      status === 'failed' ? ERROR_KINDS.SERVER : ERROR_KINDS.REQUEST,
      `Gemini answered without audio (status ${status})`,
    );
  }
  const usage = body.usage ?? {};
  const audioTokens = (usage.output_tokens_by_modality ?? []).find(
    (entry) => String(entry?.modality).toLowerCase() === 'audio',
  )?.tokens;
  const count = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  return {
    audio: Buffer.from(found.data, 'base64'),
    mimeType: String(found.mime_type ?? 'audio/wav').toLowerCase(),
    tokens: {
      input: count(usage.total_input_tokens),
      output: count(audioTokens ?? usage.total_output_tokens),
    },
  };
}

/**
 * @description A voice of the catalog, as the integration keeps it.
 * @param {object} voice - A Voice resource.
 * @returns {object} `{ id, name, type, language, gender, description }`.
 */
function voiceEntry(voice) {
  const text = (value) => (typeof value === 'string' ? value : '');
  return {
    id: text(voice.id) || text(voice.display_name),
    name: text(voice.display_name) || text(voice.id),
    type: text(voice.type) || 'prebuilt',
    language: text(voice.language_code),
    gender: text(voice.gender).toLowerCase(),
    description: text(voice.description),
  };
}

/**
 * @description Build the client.
 * @param {object} options - Options.
 * @param {() => string} options.getApiKey - The current key.
 * @param {string} [options.baseUrl] - The API root.
 * @param {typeof fetch} [options.fetchImpl] - fetch.
 * @param {(ms: number) => Promise<void>} [options.sleep] - Waits between attempts.
 * @param {() => number} [options.now] - Clock.
 * @returns {{ synthesize: Function, listVoices: Function, getVoice: Function }} The client.
 */
export function createGeminiClient({
  getApiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
}) {
  /**
   * @description One call, retried on 429 / 5xx / network while time is left.
   * @param {string} path - `/interactions`, `/voices?…`.
   * @param {object} [options] - `{ method, body, timeoutMs, retries }`.
   * @returns {Promise<any>} The parsed body.
   */
  async function call(
    path,
    { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, retries = true } = {},
  ) {
    const key = getApiKey();
    if (!key) {
      throw new GeminiError(ERROR_KINDS.AUTH, 'No API key');
    }
    const deadline = now() + timeoutMs;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const left = deadline - now();
      if (left <= 0) {
        break;
      }
      try {
        return await once(path, { method, body, key, timeoutMs: left });
      } catch (err) {
        lastError = err;
        const retryable = [
          ERROR_KINDS.RATE_LIMIT,
          ERROR_KINDS.SERVER,
          ERROR_KINDS.UNREACHABLE,
        ].includes(err.kind);
        const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
        if (!retries || !retryable || attempt === MAX_ATTEMPTS || deadline - now() <= wait + 1000) {
          throw err;
        }
        await sleep(wait);
      }
    }
    throw lastError ?? new GeminiError(ERROR_KINDS.TIMEOUT, 'Gemini did not answer in time');
  }

  async function once(path, { method, body, key, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          'x-goog-api-key': key,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new GeminiError(ERROR_KINDS.TIMEOUT, 'Gemini did not answer in time');
      }
      throw new GeminiError(
        ERROR_KINDS.UNREACHABLE,
        `Cannot reach Google: ${maskKeys(err?.cause?.code ?? err?.message ?? err)}`,
      );
    }
    let text;
    try {
      text = await response.text();
    } catch (err) {
      throw new GeminiError(
        controller.signal.aborted ? ERROR_KINDS.TIMEOUT : ERROR_KINDS.UNREACHABLE,
        `Answer of Google cut: ${maskKeys(err?.message ?? err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!response.ok) {
      const kind = kindOfStatus(response.status, parsed);
      throw new GeminiError(
        kind,
        `HTTP ${response.status}: ${errorMessageOf(parsed) || response.statusText || 'error'}`,
        { status: response.status, code: codeOf(parsed) || reasonOf(parsed) || null },
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new GeminiError(ERROR_KINDS.SERVER, 'Google answered something that is not JSON');
    }
    return parsed;
  }

  return {
    /**
     * @description Speak one clip.
     * @param {object} request - The CreateInteraction body.
     * @param {object} [options] - `{ timeoutMs, retries }`.
     * @returns {Promise<{ audio: Buffer, mimeType: string, tokens: object }>} The clip.
     */
    async synthesize(request, options = {}) {
      const body = await call('/interactions', { method: 'POST', body: request, ...options });
      return audioOf(body);
    },

    /**
     * @description The voices of the catalog, the custom ones first.
     * @param {object} [filters] - `{ type }` ("prebuilt", "prompted"…).
     * @param {object} [options] - `{ timeoutMs, retries, pageSize }`.
     * @returns {Promise<Array<object>>} The voices.
     */
    async listVoices({ type } = {}, { pageSize = 1000, ...options } = {}) {
      const voices = [];
      let token = '';
      // A few pages at most: the catalog holds hundreds of voices.
      for (let page = 0; page < 5; page += 1) {
        const query = new URLSearchParams({ page_size: String(pageSize) });
        if (type) {
          query.append('type', type);
        }
        if (token) {
          query.set('page_token', token);
        }
        const body = await call(`/voices?${query}`, options);
        for (const voice of Array.isArray(body.voices) ? body.voices : []) {
          if (voice && typeof voice === 'object') {
            voices.push(voiceEntry(voice));
          }
        }
        token = typeof body.next_page_token === 'string' ? body.next_page_token : '';
        if (!token || pageSize < 1000) {
          break;
        }
      }
      return voices;
    },

    /**
     * @description One stored custom voice.
     * @param {string} id - `voice_…`.
     * @param {object} [options] - `{ timeoutMs, retries }`.
     * @returns {Promise<object>} The voice.
     */
    async getVoice(id, options = {}) {
      const body = await call(`/voices/${encodeURIComponent(id)}`, options);
      return voiceEntry(body);
    },
  };
}
