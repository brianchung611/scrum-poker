import type { CardValue, DeckId, RoomState, VoteStats } from './types.js';

// Client -> Server
export const CLIENT_EVENTS = {
  JOIN_ROOM: 'join_room',
  CAST_VOTE: 'cast_vote',
  REVEAL_VOTES: 'reveal_votes',
  RESET_ROUND: 'reset_round',
  KICK_PARTICIPANT: 'kick_participant',
  CHANGE_DECK: 'change_deck',
  SET_STORY: 'set_story',
  TRANSFER_FACILITATOR: 'transfer_facilitator',
  START_TIMER: 'start_timer',
  STOP_TIMER: 'stop_timer',
} as const;

// Server -> Client
export const SERVER_EVENTS = {
  ROOM_STATE: 'room_state',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  VOTE_CAST: 'vote_cast',
  VOTES_REVEALED: 'votes_revealed',
  ROUND_RESET: 'round_reset',
  STORY_CHANGED: 'story_changed',
  TIMER_STARTED: 'timer_started',
  TIMER_STOPPED: 'timer_stopped',
  ERROR: 'error',
} as const;

export interface JoinRoomPayload {
  roomCode: string;
  displayName: string;
  /** Join without voting. */
  observer?: boolean;
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

export interface SetStoryPayload {
  story: string;
}

export interface TransferFacilitatorPayload {
  participantId: string;
}

export interface StartTimerPayload {
  seconds: number;
}

export interface StoryChangedPayload {
  story: string;
}

export interface TimerStartedPayload {
  /** Remaining time rather than an end timestamp, so client clock skew doesn't matter. */
  remainingMs: number;
}

export interface ParticipantJoinedPayload {
  participantId: string;
  displayName: string;
  isObserver: boolean;
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
