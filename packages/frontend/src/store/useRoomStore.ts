import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type ErrorPayload,
  type JoinRoomPayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
  type RoomState,
} from '@scrum-poker/shared';
import { create } from 'zustand';
import { socket } from '../socket/socket';

interface RoomStore {
  room: RoomState | null;
  connected: boolean;
  /** Language-agnostic error code from the server (e.g. `room_not_found`). */
  error: string | null;
}

export const useRoomStore = create<RoomStore>(() => ({
  room: null,
  connected: false,
  error: null,
}));

/**
 * Connects the socket and joins a room. Returns a cleanup function that leaves.
 * `join_room` is re-sent on every `connect`, so a dropped connection recovers
 * with a fresh full `room_state` snapshot.
 */
export function joinRoom(roomCode: string, displayName: string): () => void {
  useRoomStore.setState({ room: null, error: null, connected: socket.connected });

  const emitJoin = () => {
    const payload: JoinRoomPayload = { roomCode, displayName };
    socket.emit(CLIENT_EVENTS.JOIN_ROOM, payload);
  };

  const onConnect = () => {
    useRoomStore.setState({ connected: true });
    emitJoin();
  };
  const onDisconnect = () => useRoomStore.setState({ connected: false });
  const onRoomState = (room: RoomState) => useRoomStore.setState({ room, error: null });
  const onParticipantJoined = ({ participantId, displayName }: ParticipantJoinedPayload) =>
    useRoomStore.setState(({ room }) => {
      if (!room || room.players.some((p) => p.id === participantId)) return {};
      const player = { id: participantId, displayName, isFacilitator: false, hasVoted: false };
      return { room: { ...room, players: [...room.players, player] } };
    });
  const onParticipantLeft = ({ participantId }: ParticipantLeftPayload) =>
    useRoomStore.setState(({ room }) =>
      room ? { room: { ...room, players: room.players.filter((p) => p.id !== participantId) } } : {},
    );
  const onError = ({ message }: ErrorPayload) => useRoomStore.setState({ error: message });

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on(SERVER_EVENTS.ROOM_STATE, onRoomState);
  socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
  socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
  socket.on(SERVER_EVENTS.ERROR, onError);

  if (socket.connected) emitJoin();
  else socket.connect();

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off(SERVER_EVENTS.ROOM_STATE, onRoomState);
    socket.off(SERVER_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
    socket.off(SERVER_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
    socket.off(SERVER_EVENTS.ERROR, onError);
    socket.disconnect();
    useRoomStore.setState({ room: null, connected: false, error: null });
  };
}
