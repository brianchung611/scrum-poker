import { createServer } from 'node:http';
import {
  DEFAULT_DECK,
  resolveDeck,
  type CreateRoomRequest,
  type CreateRoomResponse,
} from '@scrum-poker/shared';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { startRoomCleanup } from './cleanup.js';
import { createRoom } from './rooms.js';
import { registerSocketHandlers } from './socketHandlers.js';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
// Rooms with no activity for this long are deleted (PRD: ~2 hours).
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MINUTES ?? 120) * 60_000;
const CLEANUP_INTERVAL_MS = Number(process.env.ROOM_CLEANUP_INTERVAL_SECONDS ?? 60) * 1000;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
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

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});
registerSocketHandlers(io);
startRoomCleanup(io, ROOM_TTL_MS, CLEANUP_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`Scrum Poker backend listening on port ${PORT}`);
});
