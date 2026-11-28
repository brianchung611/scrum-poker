import { describe, expect, it } from 'vitest';
import {
  isNumericCard,
  MAX_CARD_LENGTH,
  MAX_CUSTOM_CARDS,
  normalizeCustomCards,
  PRESET_DECKS,
  resolveDeck,
  splitCustomCards,
} from './decks.js';

describe('splitCustomCards', () => {
  it('splits on commas (ASCII and fullwidth) and newlines, trimming and dropping empties', () => {
    expect(splitCustomCards(' 1, 2 ,,3，4\n5 ')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns an empty list for blank input', () => {
    expect(splitCustomCards('  ,, ')).toEqual([]);
  });
});

describe('normalizeCustomCards', () => {
  it('trims cards and accepts a valid list', () => {
    expect(normalizeCustomCards([' 1 ', '2', 'XL', '?'])).toEqual(['1', '2', 'XL', '?']);
  });

  it.each([
    ['not an array', 'abc'],
    ['undefined', undefined],
    ['too few cards', ['1']],
    ['too many cards', Array.from({ length: MAX_CUSTOM_CARDS + 1 }, (_, i) => String(i))],
    ['duplicates', ['1', '1']],
    ['duplicates after trimming', ['1', ' 1 ']],
    ['empty card', ['1', '  ']],
    ['non-string card', ['1', 2]],
    ['card too long', ['1', 'x'.repeat(MAX_CARD_LENGTH + 1)]],
  ])('rejects %s', (_name, input) => {
    expect(normalizeCustomCards(input)).toBeNull();
  });

  it('accepts the boundary sizes', () => {
    const max = Array.from({ length: MAX_CUSTOM_CARDS }, (_, i) => `c${i}`);
    expect(normalizeCustomCards(max)).toHaveLength(MAX_CUSTOM_CARDS);
    expect(normalizeCustomCards(['1', 'x'.repeat(MAX_CARD_LENGTH)])).not.toBeNull();
  });
});

describe('resolveDeck', () => {
  it.each(['fibonacci', 'tshirt', 'powers_of_2'] as const)('resolves the %s preset', (id) => {
    const deck = resolveDeck(id);
    expect(deck).toEqual({ deckId: id, cards: PRESET_DECKS[id] });
  });

  it('returns a copy so callers cannot mutate the preset', () => {
    const deck = resolveDeck('fibonacci')!;
    deck.cards.push('999');
    expect(PRESET_DECKS.fibonacci).not.toContain('999');
  });

  it('resolves a valid custom deck with trimmed cards', () => {
    expect(resolveDeck('custom', [' 1', '2 '])).toEqual({ deckId: 'custom', cards: ['1', '2'] });
  });

  it.each([
    ['unknown id', 'nope'],
    ['prototype key', '__proto__'],
    ['inherited key', 'constructor'],
    ['non-string id', 42],
    ['undefined id', undefined],
  ])('rejects %s', (_name, id) => {
    expect(resolveDeck(id)).toBeNull();
  });

  it('rejects custom without a valid card list', () => {
    expect(resolveDeck('custom')).toBeNull();
    expect(resolveDeck('custom', ['1', '1'])).toBeNull();
  });

  it('ignores custom cards for preset decks', () => {
    expect(resolveDeck('tshirt', ['1', '2'])?.cards).toEqual(PRESET_DECKS.tshirt);
  });
});

describe('isNumericCard', () => {
  it.each(['0', '5', '13', '0.5'])('treats %s as numeric', (card) => {
    expect(isNumericCard(card)).toBe(true);
  });

  it.each(['?', '☕', 'XL', '', '1e3', '-1', ' 2', '1,5', '0x10'])('treats %j as non-numeric', (card) => {
    expect(isNumericCard(card)).toBe(false);
  });
});
