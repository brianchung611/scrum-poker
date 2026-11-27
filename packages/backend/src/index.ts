import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

httpServer.listen(PORT, () => {
  console.log(`Scrum Poker backend listening on port ${PORT}`);
});
