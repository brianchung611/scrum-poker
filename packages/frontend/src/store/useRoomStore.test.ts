import type { RoomState } from '@scrum-poker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  castVote,
  changeDeck,
  joinRoom,
  kickParticipant,
  resetRound,
  revealVotes,
  setStory,
  startTimer,
  stopTimer,
  transferFacilitator,
  useRoomStore,
} from './useRoomStore';

// A fake Socket.io client: records what the app sends and lets tests play server events.
const { fake } = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;
  const listeners = new Map<string, Set<Listener>>();
  const fake = {
    connected: false,
    sent: [] as [string, unknown][],
    on(event: string, fn: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off(event: string, fn: Listener) {
      listeners.get(event)?.delete(fn);
    },
    emit(event: string, payload?: unknown) {
      fake.sent.push([event, payload]);
    },
    connect() {
      fake.connected = true;
      fake.trigger('connect');
    },
    disconnect() {
      fake.connected = false;
      fake.trigger('disconnect');
    },
    /** Play an event from the server. */
    trigger(event: string, ...args: unknown[]) {
      [...(listeners.get(event) ?? [])].forEach((fn) => fn(...args));
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    reset() {
      listeners.clear();
      fake.sent.length = 0;
      fake.connected = false;
    },
  };
  return { fake };
});

vi.mock('../socket/socket', () => ({ socket: fake, SERVER_URL: 'http://test' }));

const alice = { id: 'a', displayName: 'Alice', isFacilitator: true, isObserver: false, hasVoted: false };
const bob = { id: 'b', displayName: 'Bob', isFacilitator: false, isObserver: false, hasVoted: false };

function snapshot(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomCode: 'ABC123',
    deckId: 'fibonacci',
    cards: ['1', '2', '3', '5'],
    phase: 'voting',
    story: '',
    timer: null,
    players: [alice, bob],
    facilitatorId: 'a',
    myId: 'a',
    myVote: null,
    ...overrides,
  };
}

const state = () => useRoomStore.getState();
let leave: () => void;

/** Joins and plays the server's snapshot. */
function joined(overrides: Partial<RoomState> = {}) {
  leave = joinRoom('ABC123', 'Alice');
  fake.trigger('room_state', snapshot(overrides));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  fake.reset();
  useRoomStore.setState({ room: null, connected: false, error: null, notice: null, timerEndsAt: null });
});
afterEach(() => {
  leave?.();
  vi.useRealTimers();
});

describe('joinRoom', () => {
  it('connects and sends join_room (with the observer flag) once connected', () => {
    leave = joinRoom('ABC123', 'Alice', true);
    expect(fake.sent).toEqual([
      ['join_room', { roomCode: 'ABC123', displayName: 'Alice', observer: true }],
    ]);
    expect(state().connected).toBe(true);
  });

  it('re-sends join_room whenever the socket reconnects, and shows the dropped state meanwhile', () => {
    leave = joinRoom('ABC123', 'Alice');
    fake.sent.length = 0;

    fake.trigger('disconnect');
    expect(state().connected).toBe(false);
    fake.trigger('connect');

    expect(state().connected).toBe(true);
    expect(fake.sent).toEqual([['join_room', { roomCode: 'ABC123', displayName: 'Alice', observer: false }]]);
  });

  it('joins immediately when the socket is already connected', () => {
    fake.connected = true;
    leave = joinRoom('ABC123', 'Alice');
    expect(fake.sent).toHaveLength(1);
  });

  it('cleans up listeners, disconnects and resets the store on leave', () => {
    joined();
    expect(fake.listenerCount()).toBeGreaterThan(0);

    leave();

    expect(fake.listenerCount()).toBe(0);
    expect(fake.connected).toBe(false);
    expect(state()).toMatchObject({ room: null, connected: false, error: null, notice: null, timerEndsAt: null });
  });
});

describe('server events', () => {
  it('room_state replaces the room and derives the timer end from the remaining time', () => {
    joined({ timer: { remainingMs: 20_000 }, story: 'PROJ-1' });
    expect(state().room).toMatchObject({ roomCode: 'ABC123', story: 'PROJ-1' });
    expect(state().timerEndsAt).toBe(1_020_000);

    fake.trigger('room_state', snapshot({ timer: null }));
    expect(state().timerEndsAt).toBeNull();
  });

  it('participant_joined adds a player once; participant_left removes one', () => {
    joined({ players: [alice] });
    const joinedPayload = { participantId: 'b', displayName: 'Bob', isObserver: true };
    fake.trigger('participant_joined', joinedPayload);
    fake.trigger('participant_joined', joinedPayload);
    expect(state().room!.players.map((p) => [p.id, p.isObserver])).toEqual([['a', false], ['b', true]]);

    fake.trigger('participant_left', { participantId: 'b' });
    expect(state().room!.players.map((p) => p.id)).toEqual(['a']);
  });

  it('ignores participant events before the room snapshot has arrived', () => {
    leave = joinRoom('ABC123', 'Alice');
    fake.trigger('participant_joined', { participantId: 'b', displayName: 'Bob', isObserver: false });
    fake.trigger('vote_cast', { participantId: 'b', hasVoted: true });
    expect(state().room).toBeNull();
  });

  it('vote_cast marks only that player as voted', () => {
    joined();
    fake.trigger('vote_cast', { participantId: 'b', hasVoted: true });
    expect(state().room!.players.map((p) => p.hasVoted)).toEqual([false, true]);
  });

  it('votes_revealed switches to the revealed phase with results and stops the timer', () => {
    joined({ timer: { remainingMs: 5_000 } });
    const stats = { average: 3, median: 3, min: 1, max: 5 };
    fake.trigger('votes_revealed', { votes: { a: '5', b: '1' }, stats });
    expect(state().room).toMatchObject({ phase: 'revealed', votes: { a: '5', b: '1' }, stats });
    expect(state().timerEndsAt).toBeNull();
  });

  it('round_reset clears votes, results, my vote, hasVoted and the timer', () => {
    joined({
      phase: 'revealed',
      myVote: '5',
      votes: { a: '5' },
      stats: { average: 5, median: 5, min: 5, max: 5 },
      players: [{ ...alice, hasVoted: true }, bob],
      timer: { remainingMs: 1_000 },
    });
    fake.trigger('round_reset');
    expect(state().room).toMatchObject({ phase: 'voting', myVote: null, votes: undefined, stats: undefined });
    expect(state().room!.players.every((p) => !p.hasVoted)).toBe(true);
    expect(state().timerEndsAt).toBeNull();
  });

  it('story_changed and the timer events update the story and timer', () => {
    joined();
    fake.trigger('story_changed', { story: 'PROJ-42' });
    expect(state().room!.story).toBe('PROJ-42');

    fake.trigger('timer_started', { remainingMs: 30_000 });
    expect(state().timerEndsAt).toBe(1_030_000);
    fake.trigger('timer_stopped');
    expect(state().timerEndsAt).toBeNull();
  });
});

describe('errors', () => {
  it.each(['room_not_found', 'invalid_display_name', 'room_expired'])('treats %s as fatal', (code) => {
    leave = joinRoom('ABC123', 'Alice');
    fake.trigger('error', { message: code });
    expect(state().error).toBe(code);
    expect(state().notice).toBeNull();
  });

  it('treats kicked as fatal and disconnects so the client cannot silently rejoin', () => {
    joined();
    fake.trigger('error', { message: 'kicked' });
    expect(state().error).toBe('kicked');
    expect(fake.connected).toBe(false);
  });

  it('shows other errors as a notice that clears itself, keeping the room usable', () => {
    joined();
    fake.trigger('error', { message: 'not_authorised' });
    expect(state()).toMatchObject({ notice: 'not_authorised', error: null });
    expect(state().room).not.toBeNull();

    vi.advanceTimersByTime(3_999);
    expect(state().notice).toBe('not_authorised');
    vi.advanceTimersByTime(1);
    expect(state().notice).toBeNull();
  });

  it('a newer notice restarts the clear timer', () => {
    joined();
    fake.trigger('error', { message: 'not_authorised' });
    vi.advanceTimersByTime(3_000);
    fake.trigger('error', { message: 'invalid_vote' });
    vi.advanceTimersByTime(3_000);
    expect(state().notice).toBe('invalid_vote');
    vi.advanceTimersByTime(1_000);
    expect(state().notice).toBeNull();
  });
});

describe('actions', () => {
  beforeEach(() => joined());

  it('castVote sends the vote and updates only my own vote locally', () => {
    fake.sent.length = 0;
    castVote('5');
    expect(fake.sent).toEqual([['cast_vote', { value: '5' }]]);
    expect(state().room!.myVote).toBe('5');
    expect(state().room!.players.map((p) => p.hasVoted)).toEqual([false, false]);
  });

  it('castVote does nothing once the round is revealed', () => {
    fake.trigger('votes_revealed', { votes: {}, stats: { average: null, median: null, min: null, max: null } });
    fake.sent.length = 0;
    castVote('5');
    expect(fake.sent).toEqual([]);
    expect(state().room!.myVote).toBeNull();
  });

  it('sends the facilitator actions with the right payloads', () => {
    fake.sent.length = 0;
    revealVotes();
    resetRound();
    changeDeck('custom', ['a', 'b']);
    changeDeck('tshirt');
    kickParticipant('b');
    transferFacilitator('b');
    setStory('PROJ-1');
    startTimer(30);
    stopTimer();

    expect(fake.sent).toEqual([
      ['reveal_votes', undefined],
      ['reset_round', undefined],
      ['change_deck', { deckId: 'custom', customCards: ['a', 'b'] }],
      ['change_deck', { deckId: 'tshirt', customCards: undefined }],
      ['kick_participant', { participantId: 'b' }],
      ['transfer_facilitator', { participantId: 'b' }],
      ['set_story', { story: 'PROJ-1' }],
      ['start_timer', { seconds: 30 }],
      ['stop_timer', undefined],
    ]);
  });
});
