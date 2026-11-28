import {
  CLIENT_EVENTS,
  MAX_DISPLAY_NAME_LENGTH,
  SERVER_EVENTS,
  type CastVotePayload,
  type ChangeDeckPayload,
  type ErrorPayload,
  type JoinRoomPayload,
  type KickParticipantPayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
  type VoteCastPayload,
  type VotesRevealedPayload,
} from '@scrum-poker/shared';
import type { Server, Socket } from 'socket.io';
import { normalizeRoomCode } from './roomCode.js';
import {
  addPlayer,
  castVote,
  changeDeck,
  getRoom,
  removePlayer,
  resetRound,
  revealVotes,
  toRoomState,
  type Room,
} from './rooms.js';

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

/** The room this socket has joined, or an error to the client if it hasn't joined one. */
function currentRoom(socket: Socket): Room | undefined {
  const room = getRoom((socket.data as SocketData).roomCode ?? '');
  if (!room || !room.players.has(socket.id)) {
    sendError(socket, 'not_in_room');
    return undefined;
  }
  return room;
}

/** Like currentRoom, but only the facilitator passes (checked server-side). */
function facilitatorRoom(socket: Socket): Room | undefined {
  const room = currentRoom(socket);
  if (!room) return undefined;
  if (room.facilitatorId !== socket.id) {
    sendError(socket, 'not_authorised');
    return undefined;
  }
  return room;
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

    socket.on(CLIENT_EVENTS.CAST_VOTE, (payload: Partial<CastVotePayload> | undefined) => {
      const room = currentRoom(socket);
      if (!room) return;

      const result = castVote(room, socket.id, String(payload?.value ?? ''));
      if (result !== 'ok') {
        sendError(socket, result === 'not_voting' ? 'round_not_voting' : result);
        return;
      }
      // Only the fact that a vote exists is broadcast, never its value.
      const cast: VoteCastPayload = { participantId: socket.id, hasVoted: true };
      io.to(room.code).emit(SERVER_EVENTS.VOTE_CAST, cast);
    });

    socket.on(CLIENT_EVENTS.REVEAL_VOTES, () => {
      const room = facilitatorRoom(socket);
      if (!room || room.phase === 'revealed') return;

      const revealed: VotesRevealedPayload = revealVotes(room);
      io.to(room.code).emit(SERVER_EVENTS.VOTES_REVEALED, revealed);
    });

    socket.on(CLIENT_EVENTS.RESET_ROUND, () => {
      const room = facilitatorRoom(socket);
      if (!room) return;

      resetRound(room);
      io.to(room.code).emit(SERVER_EVENTS.ROUND_RESET);
    });

    socket.on(CLIENT_EVENTS.CHANGE_DECK, (payload: Partial<ChangeDeckPayload> | undefined) => {
      const room = facilitatorRoom(socket);
      if (!room) return;

      if (!changeDeck(room, payload?.deckId, payload?.customCards)) {
        sendError(socket, 'invalid_deck');
        return;
      }
      // The deck changed and the round restarted, so everyone needs a fresh snapshot.
      for (const playerId of room.players.keys()) sendRoomState(io, room, playerId);
    });

    socket.on(
      CLIENT_EVENTS.KICK_PARTICIPANT,
      (payload: Partial<KickParticipantPayload> | undefined) => {
        const room = facilitatorRoom(socket);
        if (!room) return;

        const targetId = String(payload?.participantId ?? '');
        const target = io.sockets.sockets.get(targetId);
        if (targetId === socket.id || !target || !room.players.has(targetId)) {
          sendError(socket, 'invalid_participant');
          return;
        }

        const kicked: ErrorPayload = { message: 'kicked' };
        target.emit(SERVER_EVENTS.ERROR, kicked);
        // Same path as a disconnect: drops the player and broadcasts participant_left.
        leaveCurrentRoom(io, target);
      },
    );

    socket.on('disconnect', () => {
      leaveCurrentRoom(io, socket);
    });
  });
}
