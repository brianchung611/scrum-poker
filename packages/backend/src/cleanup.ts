import { SERVER_EVENTS, type ErrorPayload } from '@scrum-poker/shared';
import type { Server } from 'socket.io';
import { expireRooms } from './rooms.js';

/**
 * Periodically deletes rooms that have had no activity for `ttlMs`. Anyone still
 * connected to an expired room is told and disconnected. Returns a stop function.
 */
export function startRoomCleanup(io: Server, ttlMs: number, intervalMs: number): () => void {
  const timer = setInterval(() => {
    for (const room of expireRooms(Date.now(), ttlMs)) {
      const payload: ErrorPayload = { message: 'room_expired' };
      io.to(room.code).emit(SERVER_EVENTS.ERROR, payload);
      io.in(room.code).disconnectSockets(true);
      console.log(`Expired inactive room ${room.code}`);
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
