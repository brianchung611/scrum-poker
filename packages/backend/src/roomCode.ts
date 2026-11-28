import { ROOM_CODE_LENGTH } from '@scrum-poker/shared';
import { customAlphabet } from 'nanoid';

// Uppercase letters and digits, minus easily-confused characters (0/O, 1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generate = customAlphabet(ALPHABET, ROOM_CODE_LENGTH);

export function generateRoomCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generate();
    if (!isTaken(code)) return code;
  }
  throw new Error('Could not generate a unique room code');
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}
