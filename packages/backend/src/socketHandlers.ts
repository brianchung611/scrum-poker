import {
  CLIENT_EVENTS,
  MAX_DISPLAY_NAME_LENGTH,
  SERVER_EVENTS,
  type ErrorPayload,
  type JoinRoomPayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
} from '@scrum-poker/shared';
import type { Server, Socket } from 'socket.io';
import { normalizeRoomCode } from './roomCode.js';
import { addPlayer, getRoom, removePlayer, toRoomState, type Room } from './rooms.js';

interface SocketData {
  roomCode?: string;
}

function sendError(socket: Socket, message: string): void {
  const payload: ErrorPayload = { message };
  socket.emit(SERVER_EVENTS.ERROR, payload);
}

function sendRoomState(io: Server, room: Room, playerId: string): void {
  io.to(playerId).emit(SERVER_EVENTS.ROOM_STATE, toRoomState(room, playerId));
}

/** Removes the socket's player from its room and tells everyone else. */
function leaveCurrentRoom(io: Server, socket: Socket): void {
  const data = socket.data as SocketData;
  if (!data.roomCode) return;

  const code = data.roomCode;
  data.roomCode = undefined;
  void socket.leave(code);

  const room = getRoom(code);
  if (!room) return;

  const { removed, newFacilitatorId } = removePlayer(room, socket.id);
  if (!removed) return;

  const left: ParticipantLeftPayload = { participantId: socket.id };
  io.to(room.code).emit(SERVER_EVENTS.PARTICIPANT_LEFT, left);

  // Clients only learn who the facilitator is from room_state, so resend it.
  if (newFacilitatorId) {
    for (const playerId of room.players.keys()) sendRoomState(io, room, playerId);
  }
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket) => {
    socket.on(CLIENT_EVENTS.JOIN_ROOM, (payload: Partial<JoinRoomPayload> | undefined) => {
      const roomCode = normalizeRoomCode(String(payload?.roomCode ?? ''));
      const displayName = String(payload?.displayName ?? '').trim();

      if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        sendError(socket, 'invalid_display_name');
        return;
      }

      const room = getRoom(roomCode);
      if (!room) {
        sendError(socket, 'room_not_found');
        return;
      }

      const data = socket.data as SocketData;
      // Already in this room (e.g. duplicate join): just resend the snapshot.
      if (data.roomCode === room.code && room.players.has(socket.id)) {
        sendRoomState(io, room, socket.id);
        return;
      }
      // Joining a different room: leave the previous one first.
      leaveCurrentRoom(io, socket);

      const player = addPlayer(room, socket.id, displayName);
      data.roomCode = room.code;
      void socket.join(room.code);

      // Always a full snapshot, whether this is a first join or a rejoin.
      sendRoomState(io, room, socket.id);

      const joined: ParticipantJoinedPayload = {
        participantId: player.id,
        displayName: player.displayName,
      };
      socket.to(room.code).emit(SERVER_EVENTS.PARTICIPANT_JOINED, joined);
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom(io, socket);
    });
  });
}
