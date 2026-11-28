import {
  MAX_STORY_LENGTH,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  resolveDeck,
  type CardValue,
  type DeckId,
  type Player,
  type RoomPhase,
  type RoomState,
  type VoteStats,
} from '@scrum-poker/shared';
import { generateRoomCode } from './roomCode.js';
import { computeStats } from './stats.js';

export interface Room {
  code: string;
  deckId: DeckId;
  cards: CardValue[];
  phase: RoomPhase;
  // Map preserves insertion order, so the first entry is the longest-present player.
  players: Map<string, Player>;
  facilitatorId: string | null;
  /** playerId -> card. Values never leave the server until the round is revealed. */
  votes: Map<string, CardValue>;
  /** Label for the current round. */
  story: string;
  /** When the voting countdown ends (epoch ms), if one has been started. */
  timerEndsAt: number | null;
  lastActivity: number;
}

// Room state lives here, never on the socket instance, so a rejoin can always
// be answered with a full snapshot.
const rooms = new Map<string, Room>();

export function createRoom(deck: { deckId: DeckId; cards: CardValue[] }): Room {
  const code = generateRoomCode((candidate) => rooms.has(candidate));
  const room: Room = {
    code,
    deckId: deck.deckId,
    cards: deck.cards,
    phase: 'voting',
    players: new Map(),
    facilitatorId: null,
    votes: new Map(),
    story: '',
    timerEndsAt: null,
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

/** Test helper: forget every room. */
export function resetRooms(): void {
  rooms.clear();
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function touch(room: Room): void {
  room.lastActivity = Date.now();
}

/** Adds a player; the first player into an empty room becomes facilitator. */
export function addPlayer(
  room: Room,
  id: string,
  displayName: string,
  isObserver = false,
): Player {
  const isFacilitator = room.facilitatorId === null;
  const player: Player = { id, displayName, isFacilitator, isObserver, hasVoted: false };
  room.players.set(id, player);
  if (isFacilitator) room.facilitatorId = id;
  touch(room);
  return player;
}

export interface RemoveResult {
  removed: boolean;
  /** Set when the facilitator left and another player was promoted. */
  newFacilitatorId: string | null;
}

/** Removes a player, promoting the longest-present player if the facilitator left. */
export function removePlayer(room: Room, id: string): RemoveResult {
  if (!room.players.delete(id)) return { removed: false, newFacilitatorId: null };
  // Once revealed, keep the vote so the published results stay consistent.
  if (room.phase === 'voting') room.votes.delete(id);
  touch(room);

  let newFacilitatorId: string | null = null;
  if (room.facilitatorId === id) {
    const next = room.players.values().next().value as Player | undefined;
    room.facilitatorId = next?.id ?? null;
    if (next) {
      next.isFacilitator = true;
      newFacilitatorId = next.id;
    }
  }
  return { removed: true, newFacilitatorId };
}

export type CastVoteResult = 'ok' | 'not_voting' | 'invalid_vote' | 'not_in_room' | 'observer';

/** Records (or changes) a player's vote while the round is open. */
export function castVote(room: Room, playerId: string, value: CardValue): CastVoteResult {
  const player = room.players.get(playerId);
  if (!player) return 'not_in_room';
  if (player.isObserver) return 'observer';
  if (room.phase !== 'voting') return 'not_voting';
  if (!room.cards.includes(value)) return 'invalid_vote';

  room.votes.set(playerId, value);
  player.hasVoted = true;
  touch(room);
  return 'ok';
}

/** Moves the room to `revealed` and returns what to publish. */
export function revealVotes(room: Room): { votes: Record<string, CardValue>; stats: VoteStats } {
  room.phase = 'revealed';
  room.timerEndsAt = null;
  touch(room);
  return { votes: Object.fromEntries(room.votes), stats: computeStats([...room.votes.values()]) };
}

/** Starts a fresh round. The story is kept (e.g. for a deck change) unless `clearStory` is set. */
export function resetRound(room: Room, clearStory = false): void {
  room.phase = 'voting';
  room.timerEndsAt = null;
  if (clearStory) room.story = '';
  room.votes.clear();
  for (const player of room.players.values()) player.hasVoted = false;
  touch(room);
}

/** Switches the deck. Existing votes no longer apply, so this also starts a new round. */
export function changeDeck(room: Room, deckId: unknown, customCards?: unknown): boolean {
  const deck = resolveDeck(deckId, customCards);
  if (!deck) return false;
  room.deckId = deck.deckId;
  room.cards = deck.cards;
  resetRound(room);
  return true;
}

/** Returns false if the story is too long. Empty clears it. */
export function setStory(room: Room, story: string): boolean {
  const trimmed = story.trim();
  if (trimmed.length > MAX_STORY_LENGTH) return false;
  room.story = trimmed;
  touch(room);
  return true;
}

/** Hands the facilitator role to another player in the room. */
export function transferFacilitator(room: Room, targetId: string): boolean {
  const target = room.players.get(targetId);
  if (!target || targetId === room.facilitatorId) return false;
  const current = room.facilitatorId ? room.players.get(room.facilitatorId) : undefined;
  if (current) current.isFacilitator = false;
  target.isFacilitator = true;
  room.facilitatorId = targetId;
  touch(room);
  return true;
}

/** Starts (or restarts) the voting countdown; returns the remaining ms, or null if invalid. */
export function startTimer(room: Room, seconds: unknown, now: number): number | null {
  if (
    typeof seconds !== 'number' ||
    !Number.isInteger(seconds) ||
    seconds < TIMER_MIN_SECONDS ||
    seconds > TIMER_MAX_SECONDS
  ) {
    return null;
  }
  room.timerEndsAt = now + seconds * 1000;
  touch(room);
  return seconds * 1000;
}

export function stopTimer(room: Room): void {
  room.timerEndsAt = null;
  touch(room);
}

/** Deletes rooms with no activity for `ttlMs` and returns them so players can be notified. */
export function expireRooms(now: number, ttlMs: number): Room[] {
  const expired: Room[] = [];
  for (const room of rooms.values()) {
    if (now - room.lastActivity >= ttlMs) {
      rooms.delete(room.code);
      expired.push(room);
    }
  }
  return expired;
}

export function toRoomState(room: Room, myId: string): RoomState {
  const state: RoomState = {
    roomCode: room.code,
    deckId: room.deckId,
    cards: room.cards,
    phase: room.phase,
    story: room.story,
    timer: room.timerEndsAt === null ? null : { remainingMs: Math.max(0, room.timerEndsAt - Date.now()) },
    players: [...room.players.values()],
    facilitatorId: room.facilitatorId,
    myId,
    myVote: room.votes.get(myId) ?? null,
  };
  // Vote values are only ever included once the round has been revealed.
  if (room.phase === 'revealed') {
    state.votes = Object.fromEntries(room.votes);
    state.stats = computeStats([...room.votes.values()]);
  }
  return state;
}
