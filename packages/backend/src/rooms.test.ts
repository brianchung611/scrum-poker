import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPlayer,
  castVote,
  changeDeck,
  createRoom,
  expireRooms,
  getRoom,
  removePlayer,
  resetRooms,
  resetRound,
  revealVotes,
  setStory,
  startTimer,
  stopTimer,
  toRoomState,
  transferFacilitator,
  type Room,
} from './rooms.js';

const fib = { deckId: 'fibonacci' as const, cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] };

function roomWith(...names: string[]): Room {
  const room = createRoom(fib);
  names.forEach((name) => addPlayer(room, name.toLowerCase(), name));
  return room;
}

beforeEach(() => resetRooms());

describe('createRoom / getRoom', () => {
  it('creates a unique room per call and can find it again', () => {
    const a = createRoom(fib);
    const b = createRoom(fib);
    expect(a.code).not.toBe(b.code);
    expect(getRoom(a.code)).toBe(a);
    expect(a.phase).toBe('voting');
    expect(a.story).toBe('');
    expect(a.timerEndsAt).toBeNull();
  });
});

describe('players and facilitator', () => {
  it('makes the first player the facilitator and nobody else', () => {
    const room = roomWith('Alice', 'Bob');
    expect(room.facilitatorId).toBe('alice');
    expect([...room.players.values()].map((p) => p.isFacilitator)).toEqual([true, false]);
  });

  it('records the observer flag', () => {
    const room = createRoom(fib);
    expect(addPlayer(room, 'c', 'Cy', true).isObserver).toBe(true);
    expect(addPlayer(room, 'd', 'Dee').isObserver).toBe(false);
  });

  it('promotes the longest-present player when the facilitator leaves', () => {
    const room = roomWith('Alice', 'Bob', 'Cy');
    expect(removePlayer(room, 'alice')).toEqual({ removed: true, newFacilitatorId: 'bob' });
    expect(room.facilitatorId).toBe('bob');
    expect(room.players.get('bob')?.isFacilitator).toBe(true);
  });

  it('does not change the facilitator when someone else leaves, or reports unknown players', () => {
    const room = roomWith('Alice', 'Bob');
    expect(removePlayer(room, 'bob')).toEqual({ removed: true, newFacilitatorId: null });
    expect(removePlayer(room, 'ghost')).toEqual({ removed: false, newFacilitatorId: null });
    expect(room.facilitatorId).toBe('alice');
  });

  it('leaves the room without a facilitator when the last player leaves, then the next joiner takes it', () => {
    const room = roomWith('Alice');
    removePlayer(room, 'alice');
    expect(room.facilitatorId).toBeNull();
    expect(addPlayer(room, 'bob', 'Bob').isFacilitator).toBe(true);
  });
});

describe('castVote', () => {
  it('records and replaces a vote and marks the player as voted', () => {
    const room = roomWith('Alice');
    expect(castVote(room, 'alice', '5')).toBe('ok');
    expect(castVote(room, 'alice', '8')).toBe('ok');
    expect(room.votes.get('alice')).toBe('8');
    expect(room.players.get('alice')?.hasVoted).toBe(true);
  });

  it('rejects unknown players, observers, cards outside the deck and votes after reveal', () => {
    const room = roomWith('Alice');
    addPlayer(room, 'cy', 'Cy', true);
    expect(castVote(room, 'ghost', '5')).toBe('not_in_room');
    expect(castVote(room, 'cy', '5')).toBe('observer');
    expect(castVote(room, 'alice', '99')).toBe('invalid_vote');
    revealVotes(room);
    expect(castVote(room, 'alice', '5')).toBe('not_voting');
    expect(room.votes.size).toBe(0);
  });
});

describe('removePlayer and votes', () => {
  it('drops the leaver’s vote while voting but keeps it once revealed', () => {
    const voting = roomWith('Alice', 'Bob');
    castVote(voting, 'bob', '5');
    removePlayer(voting, 'bob');
    expect(voting.votes.has('bob')).toBe(false);

    const revealed = roomWith('Alice', 'Bob');
    castVote(revealed, 'bob', '5');
    revealVotes(revealed);
    removePlayer(revealed, 'bob');
    expect(revealed.votes.get('bob')).toBe('5');
  });
});

describe('revealVotes / resetRound', () => {
  it('returns votes and numeric stats and moves to revealed', () => {
    const room = roomWith('Alice', 'Bob', 'Cy');
    castVote(room, 'alice', '5');
    castVote(room, 'bob', '13');
    castVote(room, 'cy', '?');
    const result = revealVotes(room);
    expect(room.phase).toBe('revealed');
    expect(result.votes).toEqual({ alice: '5', bob: '13', cy: '?' });
    expect(result.stats).toEqual({ average: 9, median: 9, min: 5, max: 13 });
  });

  it('reveal clears a running timer', () => {
    const room = roomWith('Alice');
    startTimer(room, 30, 0);
    revealVotes(room);
    expect(room.timerEndsAt).toBeNull();
  });

  it('resets votes, hasVoted, phase and timer, and only clears the story on request', () => {
    const room = roomWith('Alice');
    setStory(room, 'PROJ-1');
    castVote(room, 'alice', '5');
    startTimer(room, 30, 0);
    revealVotes(room);

    resetRound(room);
    expect(room).toMatchObject({ phase: 'voting', timerEndsAt: null, story: 'PROJ-1' });
    expect(room.votes.size).toBe(0);
    expect(room.players.get('alice')?.hasVoted).toBe(false);

    resetRound(room, true);
    expect(room.story).toBe('');
  });
});

describe('changeDeck', () => {
  it('switches to a preset or custom deck and starts a new round, keeping the story', () => {
    const room = roomWith('Alice');
    setStory(room, 'PROJ-1');
    castVote(room, 'alice', '5');

    expect(changeDeck(room, 'tshirt')).toBe(true);
    expect(room.deckId).toBe('tshirt');
    expect(room.cards).toContain('XL');
    expect(room.votes.size).toBe(0);
    expect(room.story).toBe('PROJ-1');

    expect(changeDeck(room, 'custom', ['a', 'b'])).toBe(true);
    expect(room.cards).toEqual(['a', 'b']);
  });

  it('rejects invalid decks without changing anything', () => {
    const room = roomWith('Alice');
    castVote(room, 'alice', '5');
    expect(changeDeck(room, 'bogus')).toBe(false);
    expect(changeDeck(room, 'custom', ['x'])).toBe(false);
    expect(room.deckId).toBe('fibonacci');
    expect(room.votes.size).toBe(1);
  });
});

describe('setStory', () => {
  it('trims, allows clearing, and rejects stories over the limit', () => {
    const room = roomWith('Alice');
    expect(setStory(room, '  PROJ-42  ')).toBe(true);
    expect(room.story).toBe('PROJ-42');
    expect(setStory(room, '')).toBe(true);
    expect(room.story).toBe('');
    expect(setStory(room, 'x'.repeat(101))).toBe(false);
    expect(setStory(room, 'x'.repeat(100))).toBe(true);
  });
});

describe('transferFacilitator', () => {
  it('moves the role to another player', () => {
    const room = roomWith('Alice', 'Bob');
    expect(transferFacilitator(room, 'bob')).toBe(true);
    expect(room.facilitatorId).toBe('bob');
    expect(room.players.get('alice')?.isFacilitator).toBe(false);
    expect(room.players.get('bob')?.isFacilitator).toBe(true);
  });

  it('rejects the current facilitator and unknown players', () => {
    const room = roomWith('Alice', 'Bob');
    expect(transferFacilitator(room, 'alice')).toBe(false);
    expect(transferFacilitator(room, 'ghost')).toBe(false);
    expect(room.facilitatorId).toBe('alice');
  });
});

describe('timer', () => {
  it('starts with a valid duration and reports the remaining ms', () => {
    const room = roomWith('Alice');
    expect(startTimer(room, 30, 1_000)).toBe(30_000);
    expect(room.timerEndsAt).toBe(31_000);
    stopTimer(room);
    expect(room.timerEndsAt).toBeNull();
  });

  it.each([
    ['too short', 4],
    ['too long', 601],
    ['fractional', 30.5],
    ['a string', '30'],
    ['NaN', Number.NaN],
    ['undefined', undefined],
  ])('rejects a duration that is %s', (_name, seconds) => {
    const room = roomWith('Alice');
    expect(startTimer(room, seconds, 0)).toBeNull();
    expect(room.timerEndsAt).toBeNull();
  });

  it('accepts the boundaries', () => {
    const room = roomWith('Alice');
    expect(startTimer(room, 5, 0)).toBe(5_000);
    expect(startTimer(room, 600, 0)).toBe(600_000);
  });
});

describe('toRoomState', () => {
  afterEach(() => vi.useRealTimers());

  it('never includes votes or stats while voting, only the recipient’s own vote', () => {
    const room = roomWith('Alice', 'Bob');
    castVote(room, 'alice', '5');
    castVote(room, 'bob', '13');

    const forAlice = toRoomState(room, 'alice');
    expect(forAlice.myVote).toBe('5');
    expect(forAlice.votes).toBeUndefined();
    expect(forAlice.stats).toBeUndefined();
    // The deck itself contains "13", so check for the vote-bearing keys rather than the value.
    expect(JSON.stringify(forAlice)).not.toMatch(/"(votes|stats)"/);
    expect(JSON.stringify(forAlice.players)).not.toContain('13');
  });

  it('includes votes and stats once revealed', () => {
    const room = roomWith('Alice', 'Bob');
    castVote(room, 'alice', '5');
    castVote(room, 'bob', '13');
    revealVotes(room);

    const state = toRoomState(room, 'bob');
    expect(state.votes).toEqual({ alice: '5', bob: '13' });
    expect(state.stats).toEqual({ average: 9, median: 9, min: 5, max: 13 });
    expect(state.myId).toBe('bob');
  });

  it('reports the remaining timer time, floored at zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const room = roomWith('Alice');
    expect(toRoomState(room, 'alice').timer).toBeNull();

    startTimer(room, 30, Date.now());
    vi.setSystemTime(20_000);
    expect(toRoomState(room, 'alice').timer).toEqual({ remainingMs: 20_000 });
    vi.setSystemTime(99_000);
    expect(toRoomState(room, 'alice').timer).toEqual({ remainingMs: 0 });
  });
});

describe('expireRooms', () => {
  it('removes only rooms idle for at least the TTL and returns them', () => {
    const idle = createRoom(fib);
    const active = createRoom(fib);
    idle.lastActivity = 1_000;
    active.lastActivity = 9_500;

    const expired = expireRooms(10_000, 5_000);

    expect(expired).toEqual([idle]);
    expect(getRoom(idle.code)).toBeUndefined();
    expect(getRoom(active.code)).toBe(active);
  });
});
