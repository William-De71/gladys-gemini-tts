# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-14

### Added

- **tts:** the voice of Gladys on Gemini text-to-speech (your own Gemini API key): scene notifications and the replies of the voice assistant, in the language of the text
- **voices:** Gemini 3.8 Flash-Lite TTS or Flash TTS, the 30 prebuilt voices, a voice of the Extended Voice Library or a voice designed in Google AI Studio, a speaking style for every clip, vocal tags such as `<laugh>` kept in scene texts
- **costs:** free tier or paid tier with a monthly budget estimated from the tokens Google reports (Pacific billing month), checked before every clip; clip cache so a sentence already spoken is not asked again; Markdown and emoji removed before sending
- **audio:** WAV at 24 or 16 kHz; a clip over the 5 MB Gladys accepts is brought down to 16 kHz instead of failing
- **scenes:** triggers when speech fails (key refused, credit used up, daily quota, voice or model unknown, API unreachable), when it works again, and at 80 % and 100 % of the monthly budget
- **widgets:** spending or audio of the month, clips of the day, clips from the cache, seconds of audio per day over 30 days, tier, last clip and last error
- **configuration:** "Test the voice", "List the voices" and "Empty the clip cache" buttons; connection status checked without generating anything
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README

[0.1.0]: https://github.com/William-De71/gladys-gemini-tts/releases/tag/v0.1.0
