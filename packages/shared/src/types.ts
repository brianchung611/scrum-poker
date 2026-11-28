export type Locale = 'en' | 'zh-TW' | 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh-TW', 'zh-CN'];
export const DEFAULT_LOCALE: Locale = 'en';

export type CardValue = string;

export type PresetDeckId = 'fibonacci' | 'tshirt' | 'powers_of_2';
export type DeckId = PresetDeckId | 'custom';

export const MAX_DISPLAY_NAME_LENGTH = 30;
export const ROOM_CODE_LENGTH = 6;

export interface CreateRoomRequest {
  deckId?: DeckId;
  /** Required when `deckId` is `custom`. */
  customCards?: CardValue[];
}

export interface CreateRoomResponse {
  roomCode: string;
}

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
  /** The cards players can pick from, in display order. */
  cards: CardValue[];
  phase: RoomPhase;
  players: Player[];
  facilitatorId: string | null;
  myId: string;
  /** The recipient's own vote (private to them); null if they haven't voted. */
  myVote: CardValue | null;
  /** Only present once the round is revealed. */
  votes?: Record<string, CardValue>;
  stats?: VoteStats;
}
