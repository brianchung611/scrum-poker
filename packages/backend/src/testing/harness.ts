import type { AddressInfo } from 'node:net';
import type { CreateRoomRequest, CreateRoomResponse, JoinRoomPayload } from '@scrum-poker/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { createServer, type ServerConfig } from '../server.js';

export interface TestServer {
  url: string;
  close: () => Promise<void>;
  /** POST /api/rooms and return the new room code. */
  createRoom: (body?: CreateRoomRequest) => Promise<string>;
}

export async function startTestServer(overrides: Partial<ServerConfig> = {}): Promise<TestServer> {
  const server = createServer({
    corsOrigin: 'http://localhost:5173',
    roomTtlMs: 60 * 60_000,
    cleanupIntervalMs: 60_000,
    ...overrides,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;

  return {
    url,
    close: server.close,
    createRoom: async (body) => {
      const res = await fetch(`${url}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      return ((await res.json()) as CreateRoomResponse).roomCode;
    },
  };
}

export interface Frame {
  event: string;
  payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * A Socket.io client that records every frame it receives.
 *
 * Tests avoid sleeping: `sync()` is a round-trip barrier. The server handles one socket's
 * events in order, so once the reply to `sync()` arrives, everything the server emitted in
 * response to this client's earlier events (including broadcasts to other clients, which
 * were queued first) has been sent.
 */
export class TestClient {
  readonly socket: Socket;
  frames: Frame[] = [];

  constructor(url: string) {
    this.socket = connect(url, { forceNew: true, transports: ['websocket'], reconnection: false });
    this.socket.onAny((event, payload) => this.frames.push({ event, payload }));
  }

  get id(): string {
    return this.socket.id!;
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  ready(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve) => this.socket.once('connect', () => resolve()));
  }

  emit(event: string, payload?: unknown): void {
    this.socket.emit(event, payload);
  }

  /** Joins a room and resolves with the server's first reply (`room_state` or `error`). */
  async join(roomCode: string, displayName: string, opts: Partial<JoinRoomPayload> = {}): Promise<Frame> {
    const reply = this.next(['room_state', 'error']);
    this.emit('join_room', { roomCode, displayName, ...opts });
    return reply;
  }

  /** Resolves with the next frame whose event is one of `events` (and passes `accept`, if given). */
  next(
    events: string[],
    timeoutMs = 2_000,
    accept: (payload: Frame['payload']) => boolean = () => true,
  ): Promise<Frame> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.offAny(handler);
        reject(new Error(`Timed out waiting for ${events.join(' | ')}`));
      }, timeoutMs);
      const handler = (event: string, payload: unknown) => {
        if (!events.includes(event) || !accept(payload)) return;
        clearTimeout(timer);
        this.socket.offAny(handler);
        resolve({ event, payload });
      };
      this.socket.onAny(handler);
    });
  }

  /** Round-trip barrier; see the class comment. Leaves no trace in `frames`. */
  async sync(): Promise<void> {
    // Wait for the barrier's own reply, not an earlier error that is still in flight.
    const reply = this.next(['error'], 2_000, (p) => p?.message === 'room_not_found');
    this.emit('join_room', { roomCode: 'BARRIER', displayName: 'barrier' });
    await reply;
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i];
      if (frame.event === 'error' && frame.payload?.message === 'room_not_found') {
        this.frames.splice(i, 1);
        break;
      }
    }
  }

  events(event: string): Frame['payload'][] {
    return this.frames.filter((f) => f.event === event).map((f) => f.payload);
  }

  last(event: string): Frame['payload'] | undefined {
    return this.events(event).at(-1);
  }

  /** The error code from the most recent `error` frame, if any. */
  lastError(): string | undefined {
    return this.last('error')?.message;
  }

  clear(): void {
    this.frames = [];
  }

  close(): void {
    this.socket.close();
  }

  waitForDisconnect(timeoutMs = 2_000): Promise<void> {
    if (!this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for disconnect')), timeoutMs);
      this.socket.once('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
