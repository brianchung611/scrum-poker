import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import {
  DEFAULT_DECK,
  resolveDeck,
  type CreateRoomRequest,
  type CreateRoomResponse,
} from '@scrum-poker/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import { startRoomCleanup } from './cleanup.js';
import { createRoom } from './rooms.js';
import { registerSocketHandlers } from './socketHandlers.js';

export interface ServerConfig {
  corsOrigin: string;
  /** Rooms with no activity for this long are deleted. */
  roomTtlMs: number;
  cleanupIntervalMs: number;
}

export interface AppServer {
  app: Express;
  httpServer: HttpServer;
  io: Server;
  /** Stops the cleanup timer and closes the Socket.io and HTTP servers. */
  close: () => Promise<void>;
}

/** Builds the HTTP + Socket.io server without listening, so tests can bind any port. */
export function createServer(config: ServerConfig): AppServer {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/rooms', (req, res) => {
    const { deckId = DEFAULT_DECK, customCards } = (req.body ?? {}) as CreateRoomRequest;
    const deck = resolveDeck(deckId, customCards);
    if (!deck) {
      res.status(400).json({ error: 'invalid_deck' });
      return;
    }
    const room = createRoom(deck);
    const body: CreateRoomResponse = { roomCode: room.code };
    res.status(201).json(body);
  });

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, { cors: { origin: config.corsOrigin } });
  registerSocketHandlers(io);
  const stopCleanup = startRoomCleanup(io, config.roomTtlMs, config.cleanupIntervalMs);

  const close = async () => {
    stopCleanup();
    // io.close() also closes the underlying HTTP server and disconnects clients.
    await new Promise<void>((resolve) => void io.close(() => resolve()));
  };

  return { app, httpServer, io, close };
}
