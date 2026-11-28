import { createServer } from 'node:http';
import type { CreateRoomResponse } from '@scrum-poker/shared';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { createRoom } from './rooms.js';
import { registerSocketHandlers } from './socketHandlers.js';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Rooms use the default deck until deck selection lands in a later milestone.
app.post('/api/rooms', (_req, res) => {
  const room = createRoom();
  const body: CreateRoomResponse = { roomCode: room.code };
  res.status(201).json(body);
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Scrum Poker backend listening on port ${PORT}`);
});
