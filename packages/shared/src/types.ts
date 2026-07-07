export type Locale = 'en' | 'zh-TW' | 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh-TW', 'zh-CN'];
export const DEFAULT_LOCALE: Locale = 'en';

export type CardValue = string;

export type DeckId = 'fibonacci';

export const DECKS: Record<DeckId, CardValue[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
};

export const DEFAULT_DECK: DeckId = 'fibonacci';

export type RoomPhase = 'voting' | 'revealed';

export interface Player {
  id: string;
  displayName: string;
  isFacilitator: boolean;
  hasVoted: boolean;
}

export interface VoteStats {
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

export interface RoomState {
  roomCode: string;
  deckId: DeckId;
  phase: RoomPhase;
  players: Player[];
  facilitatorId: string | null;
  myId: string;
  votes?: Record<string, CardValue>;
  stats?: VoteStats;
}
