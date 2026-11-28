import {
  DECKS,
  DEFAULT_DECK,
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
  phase: RoomPhase;
  // Map preserves insertion order, so the first entry is the longest-present player.
  players: Map<string, Player>;
  facilitatorId: string | null;
  /** playerId -> card. Values never leave the server until the round is revealed. */
  votes: Map<string, CardValue>;
  lastActivity: number;
}

// Room state lives here, never on the socket instance, so a rejoin can always
// be answered with a full snapshot.
const rooms = new Map<string, Room>();

export function createRoom(deckId: DeckId = DEFAULT_DECK): Room {
  const code = generateRoomCode((candidate) => rooms.has(candidate));
  const room: Room = {
    code,
    deckId,
    phase: 'voting',
    players: new Map(),
    facilitatorId: null,
    votes: new Map(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function touch(room: Room): void {
  room.lastActivity = Date.now();
}

/** Adds a player; the first player into an empty room becomes facilitator. */
export function addPlayer(room: Room, id: string, displayName: string): Player {
  const isFacilitator = room.facilitatorId === null;
  const player: Player = { id, displayName, isFacilitator, hasVoted: false };
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

export type CastVoteResult = 'ok' | 'not_voting' | 'invalid_vote' | 'not_in_room';

/** Records (or changes) a player's vote while the round is open. */
export function castVote(room: Room, playerId: string, value: CardValue): CastVoteResult {
  const player = room.players.get(playerId);
  if (!player) return 'not_in_room';
  if (room.phase !== 'voting') return 'not_voting';
  if (!DECKS[room.deckId].includes(value)) return 'invalid_vote';

  room.votes.set(playerId, value);
  player.hasVoted = true;
  touch(room);
  return 'ok';
}

/** Moves the room to `revealed` and returns what to publish. */
export function revealVotes(room: Room): { votes: Record<string, CardValue>; stats: VoteStats } {
  room.phase = 'revealed';
  touch(room);
  return { votes: Object.fromEntries(room.votes), stats: computeStats([...room.votes.values()]) };
}

export function resetRound(room: Room): void {
  room.phase = 'voting';
  room.votes.clear();
  for (const player of room.players.values()) player.hasVoted = false;
  touch(room);
}

export function toRoomState(room: Room, myId: string): RoomState {
  const state: RoomState = {
    roomCode: room.code,
    deckId: room.deckId,
    phase: room.phase,
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
