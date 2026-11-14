// -----------------------------------------------------------------------------
// The text sent to Gemini.
//
// The voice of Gladys reads scene notifications and the replies of the AI
// assistant, which come with Markdown (**bold**, lists, tables, links) and
// emoji. Read aloud, those are noise — and every token is billed on the paid
// tier — so they go before the text leaves.
//
// Gemini 3.8 TTS reads the text verbatim, except vocal tags between angle
// brackets (`<laugh>`, `<sigh>`, `<short pause>`…) and listener reactions
// between pipes. A scene may use the documented tags on purpose: they are
// kept. Any other `<…>` (HTML from a copied text) is removed, and pipes (a
// Markdown table) become commas, so nothing is acted out by accident.
// -----------------------------------------------------------------------------

/** The vocal tags of the speech-generation guide (checked 2026-11-14). */
export const VOCAL_TAGS = new Set([
  'argh',
  'breath',
  'heavy breath',
  'exhales',
  'cackle',
  'cheer',
  'chuckle',
  'chuckles',
  'cough',
  'cry',
  'gasp',
  'giggle',
  'groan',
  'growl',
  'grunt',
  'grr',
  'hiss',
  'laugh',
  'laughter',
  'moan',
  'pant',
  'pff',
  'phew',
  'scream',
  'shout',
  'shriek',
  'sigh',
  'sighs',
  'sneeze',
  'snicker',
  'snort',
  'sob',
  'throat-clearing',
  'tsk',
  'whimper',
  'whispers',
  'whispering',
  'yawn',
  'short pause',
  'long pause',
]);

/** Characters sent at most (the core already cuts at 2,000). */
export const MAX_CHARACTERS = 2000;

/**
 * @description Keep the documented vocal tags, drop any other `<…>`.
 * @param {string} text - The text.
 * @returns {string} The text.
 */
export function filterTags(text) {
  return text.replace(/<\s*\/?\s*([^<>\n]{1,40}?)\s*\/?\s*>/g, (whole, name) => {
    const tag = name.trim().toLowerCase().replace(/\s+/g, ' ');
    return VOCAL_TAGS.has(tag) && !whole.includes('/') ? `<${tag}>` : ' ';
  });
}

/**
 * @description Clean a text for speech.
 * @param {unknown} value - The text Gladys sent.
 * @returns {string} The text to speak, '' when nothing is left.
 */
export function prepareText(value) {
  let text = filterTags(String(value ?? ''));
  text = text
    // [label](https://…) → label
    .replace(/\[([^\]\n]{1,200})\]\((?:https?:\/\/|mailto:)[^)\s]+\)/g, '$1')
    // bare links are not read
    .replace(/https?:\/\/\S+/g, '')
    // code fences and inline code marks
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`/g, '')
    // Markdown table rules, then cells: pipes would be read as reactions
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm, '')
    .replace(/^[ \t]*\|[ \t]*/gm, '')
    .replace(/[ \t]*\|[ \t]*$/gm, '')
    .replace(/[ \t]*\|[ \t]*/g, ', ')
    // headings, quotes and bullets at line start
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    .replace(/^[ \t]*(?:[-*+•]|\d{1,3}[.)])[ \t]+/gm, '')
    // emphasis marks (not a lone * or _ inside a word)
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(])[*_](?=\S)([^*_\n]*?\S)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    // emoji and their joiners / variation selectors
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/‍|︎|️|[\u{1f3fb}-\u{1f3ff}]/gu, '')
    // a list item becomes a sentence of its own
    .replace(/([^\s.!?:;,>])[ \t]*\n+/g, '$1.\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  // Only marks, tags and punctuation left: nothing to say.
  if (!/[\p{L}\p{N}]/u.test(text.replace(/<[^<>]*>/g, ''))) {
    return '';
  }
  return fitCharacters(text);
}

/**
 * @description Keep a text under a number of characters, ending on a
 * sentence when one fits.
 * @param {string} text - The text.
 * @param {number} [max] - Characters at most.
 * @returns {string} The text.
 */
export function fitCharacters(text, max = MAX_CHARACTERS) {
  const chars = [...text];
  if (chars.length <= max) {
    return text;
  }
  const cut = chars.slice(0, max).join('');
  const sentence = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
    cut.lastIndexOf('\n'),
    cut.lastIndexOf('。'),
  );
  if (sentence > cut.length / 2) {
    return cut.slice(0, sentence + 1).trim();
  }
  const space = cut.lastIndexOf(' ');
  return (space > cut.length / 2 ? cut.slice(0, space) : cut).trim();
}
