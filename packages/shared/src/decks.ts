import type { CardValue, DeckId, PresetDeckId } from './types.js';

export const PRESET_DECKS: Record<PresetDeckId, CardValue[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers_of_2: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
};

export const DECK_IDS: DeckId[] = ['fibonacci', 'tshirt', 'powers_of_2', 'custom'];
export const DEFAULT_DECK: DeckId = 'fibonacci';

export const MIN_CUSTOM_CARDS = 2;
export const MAX_CUSTOM_CARDS = 20;
export const MAX_CARD_LENGTH = 5;

/**
 * Cleans up and validates a custom deck: trimmed, non-empty, unique, 2-20 cards of up to
 * 5 characters each. Returns null if it isn't usable.
 */
export function normalizeCustomCards(cards: unknown): CardValue[] | null {
  if (!Array.isArray(cards)) return null;
  const cleaned = cards.map((c) => (typeof c === 'string' ? c.trim() : ''));
  if (cleaned.some((c) => c.length === 0 || c.length > MAX_CARD_LENGTH)) return null;
  if (new Set(cleaned).size !== cleaned.length) return null;
  if (cleaned.length < MIN_CUSTOM_CARDS || cleaned.length > MAX_CUSTOM_CARDS) return null;
  return cleaned;
}

/** Splits user input like "1, 2, 3, ?" into a card list (not yet validated). */
export function splitCustomCards(text: string): string[] {
  return text.split(/[,，\n]/).map((c) => c.trim()).filter((c) => c.length > 0);
}

/** Resolves a deck choice to its cards, or null if the choice is invalid. */
export function resolveDeck(
  deckId: unknown,
  customCards?: unknown,
): { deckId: DeckId; cards: CardValue[] } | null {
  if (deckId === 'custom') {
    const cards = normalizeCustomCards(customCards);
    return cards ? { deckId, cards } : null;
  }
  if (typeof deckId === 'string' && Object.hasOwn(PRESET_DECKS, deckId)) {
    const id = deckId as PresetDeckId;
    return { deckId: id, cards: [...PRESET_DECKS[id]] };
  }
  return null;
}
