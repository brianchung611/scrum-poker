import type { CardValue, DeckId, RoomState, VoteStats } from './types.js';

// Client -> Server
export const CLIENT_EVENTS = {
  JOIN_ROOM: 'join_room',
  CAST_VOTE: 'cast_vote',
  REVEAL_VOTES: 'reveal_votes',
  RESET_ROUND: 'reset_round',
  KICK_PARTICIPANT: 'kick_participant',
  CHANGE_DECK: 'change_deck',
} as const;

// Server -> Client
export const SERVER_EVENTS = {
  ROOM_STATE: 'room_state',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  VOTE_CAST: 'vote_cast',
  VOTES_REVEALED: 'votes_revealed',
  ROUND_RESET: 'round_reset',
  ERROR: 'error',
} as const;

export interface JoinRoomPayload {
  roomCode: string;
  displayName: string;
}

export interface CastVotePayload {
  value: CardValue;
}

export interface KickParticipantPayload {
  participantId: string;
}

export interface ChangeDeckPayload {
  deckId: DeckId;
  /** Required when `deckId` is `custom`. */
  customCards?: CardValue[];
}

export interface ParticipantJoinedPayload {
  participantId: string;
  displayName: string;
}

export interface ParticipantLeftPayload {
  participantId: string;
}

export interface VoteCastPayload {
  participantId: string;
  hasVoted: true;
}

export interface VotesRevealedPayload {
  votes: Record<string, CardValue>;
  stats: VoteStats;
}

export interface ErrorPayload {
  message: string;
}

export type RoomStatePayload = RoomState;
