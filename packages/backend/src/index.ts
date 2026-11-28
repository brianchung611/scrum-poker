import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 4000);

const { httpServer } = createServer({
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Rooms with no activity for this long are deleted (PRD: ~2 hours).
  roomTtlMs: Number(process.env.ROOM_TTL_MINUTES ?? 120) * 60_000,
  cleanupIntervalMs: Number(process.env.ROOM_CLEANUP_INTERVAL_SECONDS ?? 60) * 1000,
});

httpServer.listen(PORT, () => {
  console.log(`Scrum Poker backend listening on port ${PORT}`);
});
