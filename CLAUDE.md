# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that makes a **Gemini voice** the
voice of a Gladys instance: a Node.js service (Node 22+, ESM, no build step)
in its own sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and to the official Gemini API (`https://generativelanguage.googleapis.com/v1beta`,
Interactions API, TTS models) with the administrator's own Gemini API key
(Google AI Studio). Runtime dependency: the SDK only (plain `fetch`, no Google
library). `type: "tts"`, Gladys 5.3.0+, `transports: ["cloud"]`,
`categories: ["assistants"]`. Not affiliated with Google.

The contract (SDK README, "Text-to-speech providers"): `onTtsSynthesize(text,
language)`, `text` at most 2,000 characters, `language` the user's (`null`
when unknown); resolve `<content type>;base64,<audio>` (`audio/mpeg`,
`audio/ogg`, `audio/wav`), 5 MB decoded at most, within 30 s. **Never tested
with a real Gemini key**: request and response shapes follow the
speech-generation guide, the Interactions API reference, the voices reference,
the pricing and errors pages, checked on 2026-11-14. Only the answer to a bad
key was seen for real (see Pitfalls).

## Commands

```bash
npm install
npm test                                  # node --test; a fake Gemini API on 127.0.0.1
node --test test/app.test.js              # one file
UPDATE_BASELINE=1 npm test                # rewrite test/fixtures/manifest.baseline.json (on purpose only)
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js               SDK wiring only (new GladysIntegration + createApp)
src/app.js             every handler: onTtsSynthesize, the three buttons, widget,
                       configuration, status following the clips
src/synthesize.js      one clip: clean text, request, cache, budget BEFORE
                       spending, Gemini, WAV fitted, counters, thresholds
src/audio.js           WAV read / written, headerless PCM wrapped, 16 kHz
                       fallback over 5 MB (linear resampling, no dependency)
src/text.js            Markdown / emoji / links / tables removed; documented
                       vocal tags kept, other <…> removed; 2,000-character cut
src/gemini-api.js      fetch client: POST interactions, GET voices, GET voice;
                       x-goog-api-key header, deadline, retries on 429 per
                       minute / 5xx / network, error kinds from both error
                       shapes, keys masked
src/clip-cache.js      /data/clips: 300 clips / 40 MB, least recently used out
src/usage.js           /data/usage.json: cost, tokens, seconds per Pacific
                       billing month, per local day, cache hits, alerts
src/events.js          triggers: error (once per kind), recovered, monthly_limit
src/widgets.js         the usage widget
src/connection.js      status (one voice listed, free), the catalog kept 24 h,
                       Test the voice, List the voices
src/config.js          models and prices, the 30 voices, selects, estimates
src/i18n.js            runtime texts, en / fr / de / es
src/time.js            local days and times (TZ of Gladys, Intl only)
test/helpers/fake-gemini.js     the fake API (voices, interactions, both error shapes)
.github/scripts/release.mjs     version, changelog, bump (tested in test/)
```

## Rules

- **Every key users store is forever**: the keys of `config_schema` and the
  values of its selects (`model`, `voice`, `sample_rate`, `tier`,
  `monthly_budget`), `actions` and their fields, the widget, the triggers
  (fields, options, variables). `test/structure.test.js` compares them to
  `test/fixtures/manifest.baseline.json`: never update it to make a test pass
  without a documented migration. A retired model or voice stays in the
  select until a migration maps it.
- **Settings are selects**, not typed decimals (a decimal `number` field can be
  impossible to type in some cores): their values are strings, turned into
  numbers by `normalizeConfig`.
- **The budget is checked before spending**, on the paid tier only, against
  the estimated dollars of the **Pacific** billing month
  (`America/Los_Angeles`, like Google invoices). A clip is estimated from its
  text (12 characters a second, on purpose a little high) before the call,
  then counted from the tokens Google reports. A cache hit is free and never
  counted. Prices double on 2027-01-01 (`PRICE_CHANGE_AT`).
- **Never fall back silently**: a failure throws (the core fails the scene
  action, the assistant answers in text). Never another voice nor another
  model than the configured one.
- **Never act out by accident**: Gemini 3.8 TTS reads `<…>` as vocal tags and
  `|…|` as listener reactions. Only the documented tags (`VOCAL_TAGS`) pass;
  pipes become commas.
- **Deadlines**: the core waits 30 s; Gemini gets 26 s, retries included. A
  daily quota (`quota`) is never retried.
- **Scene events** once per transition: `error` when the failure kind
  changes, `recovered` at the first clip after, `monthly_limit` once per level
  (`warning` at 80 %, `reached` when a clip is refused) and billing month. A
  refused text (`request`, safety blocks included) and the budget (`limit`)
  never start `error`.
- **The clip cache never fails a clip**: every write error is swallowed; the
  key is a hash of the whole request, so a changed setting simply misses.
- **The API key** is a `secret`: never logged, never in /data, never in an
  error message (`maskKeys` hides `AIza…`), never in a URL (header only).
  Requests carry `store: false`.
- **The container rootfs is read-only.** Write only under `/data` (usage
  counters written at most every 10 s and at shutdown, the clip cache).
- **Four languages.** Every user-facing text (manifest, `src/i18n.js`,
  `docs/*.md`, README) exists in en, fr, de, es; `test/i18n.test.js` checks it.
  German says "du", Spanish "usted".
- **Widget images.** After any change to a widget content, run
  `docs/illustrations/render.sh` again and look at the four PNG files. Tile
  icons must exist in the Gladys theme (`fe-archive` does not).
- **Logo**: the 2025 Gemini spark (Wikimedia Commons) names the service only;
  keep the "not affiliated" notices.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  Below 1.0.0 until the maintainer runs Release with `release-as: 1.0.0`.
- **Changelog.** Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Commits and PR titles** follow Conventional Commits, in English.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.

## Pitfalls

- A wrong key is a **400** with the classic Google body **inside an array**
  (seen on 2026-11-14): `error.code` is the number 400, `error.status` is
  `INVALID_ARGUMENT` and an ErrorInfo detail carries `API_KEY_INVALID`. The
  Interactions API documents its own errors as an object whose `error.code`
  is a string (`invalid_request`, `quota_exceeded`…): `errorOf` reads both.
- 429 has two meanings: `rate_limit_exceeded` / `too_many_requests` (per
  minute, retried) and `quota_exceeded` or a message naming a daily metric
  (free tier, not retried, kind `quota`).
- 402 `payment_required`: prepaid credit used up. Never retried.
- Gemini 3.8 TTS answers a complete WAV (RIFF, 24 kHz mono 16-bit) on unary
  requests; older TTS models answered headerless `audio/l16`: `toClip` wraps
  both. 24 kHz = 48 KB a second, so about 109 s fit in the 5 MB of the core.
- The 30 prebuilt voices speak every language; the catalog voices of
  `GET /voices` may carry a `language_code`. Stored custom voices are
  `voice_…` (1 year after the last use), replicated stateless keys
  `voicekey_…` (7 days).
- Gemini TTS voices vary slightly from one generation to the next: the clip
  cache keeps the first one.
- `node --test` also runs `test/helpers/`: nothing starts on import.
- The validator of the Gladys core creates `gladys-development.duckdb` in the
  current folder: run it from elsewhere.
