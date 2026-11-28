import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type CardValue,
  type CastVotePayload,
  type ChangeDeckPayload,
  type DeckId,
  type ErrorPayload,
  type JoinRoomPayload,
  type KickParticipantPayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
  type RoomState,
  type SetStoryPayload,
  type StartTimerPayload,
  type StoryChangedPayload,
  type TimerStartedPayload,
  type TransferFacilitatorPayload,
  type VoteCastPayload,
  type VotesRevealedPayload,
} from '@scrum-poker/shared';
import { create } from 'zustand';
import { socket } from '../socket/socket';

interface RoomStore {
  room: RoomState | null;
  connected: boolean;
  /** Fatal, language-agnostic error code (the room can't be used), e.g. `room_not_found`. */
  error: string | null;
  /** Non-fatal error code shown briefly, e.g. `not_authorised`. */
  notice: string | null;
  /** Local epoch ms when the voting countdown ends (derived from the server's remaining time). */
  timerEndsAt: number | null;
}

export const useRoomStore = create<RoomStore>(() => ({
  room: null,
  connected: false,
  error: null,
  notice: null,
  timerEndsAt: null,
}));

// Errors that mean "you are not in a usable room"; everything else is a transient notice.
const FATAL_ERRORS = new Set([
  'room_not_found',
  'invalid_display_name',
  'kicked',
  'room_expired',
]);
const NOTICE_MS = 4000;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(code: string) {
  clearTimeout(noticeTimer);
  useRoomStore.setState({ notice: code });
  noticeTimer = setTimeout(() => useRoomStore.setState({ notice: null }), NOTICE_MS);
}

/** Casts or changes this player's vote. Only allowed while the round is open. */
export function castVote(value: CardValue): void {
  const { room } = useRoomStore.getState();
  if (!room || room.phase !== 'voting') return;
  const payload: CastVotePayload = { value };
  socket.emit(CLIENT_EVENTS.CAST_VOTE, payload);
  // Optimistic: only this player's own pick; everyone else's state waits for the server.
  useRoomStore.setState({ room: { ...room, myVote: value } });
}

/** Facilitator only (enforced by the server). */
export function revealVotes(): void {
  socket.emit(CLIENT_EVENTS.REVEAL_VOTES);
}

/** Facilitator only (enforced by the server). */
export function resetRound(): void {
  socket.emit(CLIENT_EVENTS.RESET_ROUND);
}

/** Facilitator only (enforced by the server). Starts a new round with the new deck. */
export function changeDeck(deckId: DeckId, customCards?: string[]): void {
  const payload: ChangeDeckPayload = { deckId, customCards };
  socket.emit(CLIENT_EVENTS.CHANGE_DECK, payload);
}

/** Facilitator only (enforced by the server). */
export function kickParticipant(participantId: string): void {
  const payload: KickParticipantPayload = { participantId };
  socket.emit(CLIENT_EVENTS.KICK_PARTICIPANT, payload);
}

/** Facilitator only (enforced by the server). Empty clears the story. */
export function setStory(story: string): void {
  const payload: SetStoryPayload = { story };
  socket.emit(CLIENT_EVENTS.SET_STORY, payload);
}

/** Facilitator only. Hands the role over; this client loses its controls. */
export function transferFacilitator(participantId: string): void {
  const payload: TransferFacilitatorPayload = { participantId };
  socket.emit(CLIENT_EVENTS.TRANSFER_FACILITATOR, payload);
}

/** Facilitator only. */
export function startTimer(seconds: number): void {
  const payload: StartTimerPayload = { seconds };
  socket.emit(CLIENT_EVENTS.START_TIMER, payload);
}

/** Facilitator only. */
export function stopTimer(): void {
  socket.emit(CLIENT_EVENTS.STOP_TIMER);
}

const timerEndsFrom = (remainingMs: number) => Date.now() + remainingMs;

/**
 * Connects the socket and joins a room. Returns a cleanup function that leaves.
 * `join_room` is re-sent on every `connect`, so a dropped connection recovers
 * with a fresh full `room_state` snapshot.
 */
export function joinRoom(roomCode: string, displayName: string, observer = false): () => void {
  useRoomStore.setState({
    room: null,
    error: null,
    notice: null,
    timerEndsAt: null,
    connected: socket.connected,
  });

  const emitJoin = () => {
    const payload: JoinRoomPayload = { roomCode, displayName, observer };
    socket.emit(CLIENT_EVENTS.JOIN_ROOM, payload);
  };

  const onConnect = () => {
    useRoomStore.setState({ connected: true });
    emitJoin();
  };
  const onDisconnect = () => useRoomStore.setState({ connected: false });
  const onRoomState = (room: RoomState) =>
    useRoomStore.setState({
      room,
      error: null,
      timerEndsAt: room.timer ? timerEndsFrom(room.timer.remainingMs) : null,
    });
  const onParticipantJoined = ({ participantId, displayName, isObserver }: ParticipantJoinedPayload) =>
    useRoomStore.setState(({ room }) => {
      if (!room || room.players.some((p) => p.id === participantId)) return {};
      const player = {
        id: participantId,
        displayName,
        isFacilitator: false,
        isObserver,
        hasVoted: false,
      };
      return { room: { ...room, players: [...room.players, player] } };
    });
  const onParticipantLeft = ({ participantId }: ParticipantLeftPayload) =>
    useRoomStore.setState(({ room }) =>
      room ? { room: { ...room, players: room.players.filter((p) => p.id !== participantId) } } : {},
    );
  const onVoteCast = ({ participantId, hasVoted }: VoteCastPayload) =>
    useRoomStore.setState(({ room }) =>
      room
        ? {
            room: {
              ...room,
              players: room.players.map((p) => (p.id === participantId ? { ...p, hasVoted } : p)),
            },
          }
        : {},
    );
  const onVotesRevealed = ({ votes, stats }: VotesRevealedPayload) =>
    useRoomStore.setState(({ room }) =>
      room ? { room: { ...room, phase: 'revealed', votes, stats }, timerEndsAt: null } : {},
    );
  const onRoundReset = () =>
    useRoomStore.setState(({ room }) =>
      room
        ? {
            room: {
              ...room,
              phase: 'voting',
              votes: undefined,
              stats: undefined,
              myVote: null,
              players: room.players.map((p) => ({ ...p, hasVoted: false })),
            },
            timerEndsAt: null,
          }
        : {},
    );
  const onStoryChanged = ({ story }: StoryChangedPayload) =>
    useRoomStore.setState(({ room }) => (room ? { room: { ...room, story } } : {}));
  const onTimerStarted = ({ remainingMs }: TimerStartedPayload) =>
    useRoomStore.setState({ timerEndsAt: timerEndsFrom(remainingMs) });
  const onTimerStopped = () => useRoomStore.setState({ timerEndsAt: null });
  const onError = ({ message }: ErrorPayload) => {
    if (FATAL_ERRORS.has(message)) {
      useRoomStore.setState({ error: message });
      // Don't let a removed player silently rejoin if the connection later reconnects.
      if (message === 'kicked') socket.disconnect();
    } else {
      showNotice(message);
    }
  };

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on(SERVER_EVENTS.ROOM_STATE, onRoomState);
  socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
  socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
  socket.on(SERVER_EVENTS.VOTE_CAST, onVoteCast);
  socket.on(SERVER_EVENTS.VOTES_REVEALED, onVotesRevealed);
  socket.on(SERVER_EVENTS.ROUND_RESET, onRoundReset);
  socket.on(SERVER_EVENTS.STORY_CHANGED, onStoryChanged);
  socket.on(SERVER_EVENTS.TIMER_STARTED, onTimerStarted);
  socket.on(SERVER_EVENTS.TIMER_STOPPED, onTimerStopped);
  socket.on(SERVER_EVENTS.ERROR, onError);

  if (socket.connected) emitJoin();
  else socket.connect();

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off(SERVER_EVENTS.ROOM_STATE, onRoomState);
    socket.off(SERVER_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
    socket.off(SERVER_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
    socket.off(SERVER_EVENTS.VOTE_CAST, onVoteCast);
    socket.off(SERVER_EVENTS.VOTES_REVEALED, onVotesRevealed);
    socket.off(SERVER_EVENTS.ROUND_RESET, onRoundReset);
    socket.off(SERVER_EVENTS.STORY_CHANGED, onStoryChanged);
    socket.off(SERVER_EVENTS.TIMER_STARTED, onTimerStarted);
    socket.off(SERVER_EVENTS.TIMER_STOPPED, onTimerStopped);
    socket.off(SERVER_EVENTS.ERROR, onError);
    socket.disconnect();
    clearTimeout(noticeTimer);
    useRoomStore.setState({
      room: null,
      connected: false,
      error: null,
      notice: null,
      timerEndsAt: null,
    });
  };
}
