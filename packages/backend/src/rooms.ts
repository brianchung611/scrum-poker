import {
  DEFAULT_DECK,
  type DeckId,
  type Player,
  type RoomPhase,
  type RoomState,
} from '@scrum-poker/shared';
import { generateRoomCode } from './roomCode.js';

export interface Room {
  code: string;
  deckId: DeckId;
  phase: RoomPhase;
  // Map preserves insertion order, so the first entry is the longest-present player.
  players: Map<string, Player>;
  facilitatorId: string | null;
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

export function toRoomState(room: Room, myId: string): RoomState {
  return {
    roomCode: room.code,
    deckId: room.deckId,
    phase: room.phase,
    players: [...room.players.values()],
    facilitatorId: room.facilitatorId,
    myId,
  };
}
