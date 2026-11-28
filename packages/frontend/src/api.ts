import type { CreateRoomRequest, CreateRoomResponse } from '@scrum-poker/shared';
import { SERVER_URL } from './socket/socket';

export async function createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Create room failed: ${res.status}`);
  return (await res.json()) as CreateRoomResponse;
}
