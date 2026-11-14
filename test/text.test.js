import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTags, fitCharacters, MAX_CHARACTERS, prepareText } from '../src/text.js';

test('Markdown, links and emoji are not read aloud', () => {
  assert.equal(
    prepareText(
      '## Météo\n**Il pleut** 🌧️ demain, voir [la carte](https://example.com/x) ou https://a.b/c',
    ),
    'Météo.\nIl pleut demain, voir la carte ou',
  );
  assert.equal(prepareText('- lait\n- œufs\n- pain'), 'lait.\nœufs.\npain');
  assert.equal(prepareText('La porte_du_garage est *ouverte*'), 'La porte_du_garage est ouverte');
  assert.equal(prepareText('Il est 20 h 30.'), 'Il est 20 h 30.');
  assert.equal(prepareText('🎉 ** **'), '');
  assert.equal(prepareText(null), '');
});

test('the documented vocal tags stay, any other tag goes', () => {
  assert.equal(
    prepareText('Bonjour <laugh> la porte <b>est</b> ouverte <Short  Pause> voilà'),
    'Bonjour <laugh> la porte est ouverte <short pause> voilà',
  );
  assert.equal(filterTags('<sigh/>'), ' ');
  assert.equal(prepareText('<laugh> <sigh>'), '', 'tags alone say nothing');
});

test('a Markdown table becomes sentences, never pipes', () => {
  assert.equal(
    prepareText('| Pièce | Température |\n|---|---|\n| Salon | 21 °C |'),
    'Pièce, Température.\nSalon, 21 °C',
  );
});

test('a long text stops on a sentence', () => {
  const text = `${'Phrase courte. '.repeat(200)}`;
  const cut = fitCharacters(text);
  assert.ok([...cut].length <= MAX_CHARACTERS);
  assert.ok(cut.endsWith('.'));
  assert.equal(fitCharacters('court'), 'court');
});
