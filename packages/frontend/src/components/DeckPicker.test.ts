import { describe, expect, it } from 'vitest';
import { customCardsOf, DEFAULT_DECK_CHOICE, isDeckChoiceValid } from './DeckPicker';

describe('deck choice helpers', () => {
  it('treats every preset as valid and needing no custom cards', () => {
    for (const deckId of ['fibonacci', 'tshirt', 'powers_of_2'] as const) {
      expect(customCardsOf({ deckId, customText: 'ignored' })).toEqual([]);
      expect(isDeckChoiceValid({ deckId, customText: '' })).toBe(true);
    }
    expect(isDeckChoiceValid(DEFAULT_DECK_CHOICE)).toBe(true);
  });

  it('parses and validates custom cards', () => {
    expect(customCardsOf({ deckId: 'custom', customText: ' 1, 2 , 3,? ' })).toEqual(['1', '2', '3', '?']);
    expect(isDeckChoiceValid({ deckId: 'custom', customText: '1, 2' })).toBe(true);
  });

  it.each(['', '1', '1, 1', 'abcdef, 1'])('rejects custom text %j', (customText) => {
    expect(customCardsOf({ deckId: 'custom', customText })).toBeNull();
    expect(isDeckChoiceValid({ deckId: 'custom', customText })).toBe(false);
  });
});
