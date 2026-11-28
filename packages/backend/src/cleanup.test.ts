import { SERVER_EVENTS } from '@scrum-poker/shared';
import type { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRoomCleanup } from './cleanup.js';
import { createRoom, getRoom, resetRooms, touch } from './rooms.js';

const deck = { deckId: 'fibonacci' as const, cards: ['1', '2'] };

/** Just enough of Socket.io's Server for the cleanup loop. */
function fakeIo() {
  const emitted: { room: string; event: string; payload: unknown }[] = [];
  const disconnected: string[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }),
    }),
    in: (room: string) => ({ disconnectSockets: () => disconnected.push(room) }),
  };
  return { io: io as unknown as Server, emitted, disconnected };
}

describe('startRoomCleanup', () => {
  beforeEach(() => {
    resetRooms();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('removes idle rooms, notifies and disconnects their players', () => {
    const { io, emitted, disconnected } = fakeIo();
    const room = createRoom(deck);
    const stop = startRoomCleanup(io, 1_000, 500);

    vi.advanceTimersByTime(2_000);

    expect(getRoom(room.code)).toBeUndefined();
    expect(emitted).toEqual([
      { room: room.code, event: SERVER_EVENTS.ERROR, payload: { message: 'room_expired' } },
    ]);
    expect(disconnected).toEqual([room.code]);
    stop();
  });

  it('keeps rooms that stay active', () => {
    const { io, emitted } = fakeIo();
    const room = createRoom(deck);
    const stop = startRoomCleanup(io, 1_000, 250);

    for (let i = 0; i < 8; i++) {
      vi.advanceTimersByTime(250);
      touch(room);
    }

    expect(getRoom(room.code)).toBe(room);
    expect(emitted).toEqual([]);
    stop();
  });

  it('stops sweeping once stopped', () => {
    const { io } = fakeIo();
    const room = createRoom(deck);
    const stop = startRoomCleanup(io, 1_000, 500);
    stop();

    vi.advanceTimersByTime(10_000);

    expect(getRoom(room.code)).toBe(room);
  });
});
