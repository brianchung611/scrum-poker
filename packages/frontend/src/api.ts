import type { CreateRoomResponse } from '@scrum-poker/shared';
import { SERVER_URL } from './socket/socket';

export async function createRoom(): Promise<CreateRoomResponse> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`Create room failed: ${res.status}`);
  return (await res.json()) as CreateRoomResponse;
}
