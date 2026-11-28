import { io } from 'socket.io-client';

export const SERVER_URL: string = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

// Connection is opened explicitly when a room page mounts.
export const socket = io(SERVER_URL, { autoConnect: false });
