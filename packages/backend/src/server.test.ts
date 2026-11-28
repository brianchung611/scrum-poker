import type { CreateRoomRequest } from '@scrum-poker/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRooms } from './rooms.js';
import { startTestServer, TestClient, type TestServer } from './testing/harness.js';

let server: TestServer;
const open: TestClient[] = [];

beforeAll(async () => {
  server = await startTestServer();
});
afterAll(async () => {
  await server.close();
});
beforeEach(() => resetRooms());
afterEach(() => {
  open.splice(0).forEach((c) => c.close());
});

async function connect(): Promise<TestClient> {
  const client = new TestClient(server.url);
  open.push(client);
  await client.ready();
  return client;
}

/** Creates a room and joins one client per name, in order (so the first is facilitator). */
async function roomWith(names: string[], body?: CreateRoomRequest) {
  const code = await server.createRoom(body);
  const clients: TestClient[] = [];
  for (const name of names) {
    const client = await connect();
    const reply = await client.join(code, name);
    expect(reply.event).toBe('room_state');
    clients.push(client);
  }
  for (const client of clients) {
    await client.sync();
    client.clear();
  }
  return { code, clients };
}

describe('HTTP', () => {
  it('answers the health check', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('creates a room with the default deck when no body is sent', async () => {
    const res = await fetch(`${server.url}/api/rooms`, { method: 'POST' });
    expect(res.status).toBe(201);
    const { roomCode } = (await res.json()) as { roomCode: string };
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const client = await connect();
    const reply = await client.join(roomCode, 'Alice');
    expect(reply.payload).toMatchObject({ deckId: 'fibonacci', phase: 'voting', story: '', timer: null });
  });

  it.each([
    ['unknown deck', { deckId: 'nope' }],
    ['prototype key', { deckId: '__proto__' }],
    ['custom without cards', { deckId: 'custom' }],
    ['custom with duplicates', { deckId: 'custom', customCards: ['1', '1'] }],
    ['custom with an over-long card', { deckId: 'custom', customCards: ['1', 'abcdef'] }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await fetch(`${server.url}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_deck' });
  });

  it('creates rooms with preset and trimmed custom decks', async () => {
    const tshirt = await server.createRoom({ deckId: 'tshirt' });
    const custom = await server.createRoom({ deckId: 'custom', customCards: [' 1 ', 'Z'] });
    const a = await connect();
    const b = await connect();
    expect((await a.join(tshirt, 'A')).payload.cards).toContain('XL');
    expect((await b.join(custom, 'B')).payload).toMatchObject({ deckId: 'custom', cards: ['1', 'Z'] });
  });
});

describe('joining and leaving', () => {
  it('makes the first joiner facilitator and tells existing players about newcomers', async () => {
    const code = await server.createRoom();
    const alice = await connect();
    const bob = await connect();

    const first = await alice.join(code, 'Alice');
    expect(first.payload.facilitatorId).toBe(alice.id);
    expect(first.payload.myId).toBe(alice.id);

    const second = await bob.join(code, 'Bob');
    expect(second.payload.players.map((p: { displayName: string }) => p.displayName)).toEqual(['Alice', 'Bob']);
    expect(second.payload.facilitatorId).toBe(alice.id);
    expect(second.payload.myId).toBe(bob.id);

    await bob.sync();
    await alice.sync();
    expect(alice.last('participant_joined')).toEqual({
      participantId: bob.id,
      displayName: 'Bob',
      isObserver: false,
    });
  });

  it('accepts lowercase room codes and trims display names', async () => {
    const code = await server.createRoom();
    const client = await connect();
    const reply = await client.join(code.toLowerCase(), '  Alice  ');
    expect(reply.event).toBe('room_state');
    expect(reply.payload.players[0].displayName).toBe('Alice');
  });

  it('rejects unknown rooms and invalid display names', async () => {
    const code = await server.createRoom();
    const client = await connect();
    expect((await client.join('ZZZZZZ', 'Alice')).payload).toEqual({ message: 'room_not_found' });
    expect((await client.join(code, '   ')).payload).toEqual({ message: 'invalid_display_name' });
    expect((await client.join(code, 'x'.repeat(31))).payload).toEqual({ message: 'invalid_display_name' });
  });

  it('flags observers to everyone', async () => {
    const { code, clients } = await roomWith(['Alice']);
    const cy = await connect();
    const reply = await cy.join(code, 'Cy', { observer: true });
    expect(reply.payload.players.find((p: { id: string }) => p.id === cy.id).isObserver).toBe(true);
    await clients[0].sync();
    expect(clients[0].last('participant_joined')).toMatchObject({ displayName: 'Cy', isObserver: true });
  });

  it('resends a snapshot (without duplicating the player) on a repeated join', async () => {
    const { code, clients } = await roomWith(['Alice']);
    const reply = await clients[0].join(code, 'Alice');
    expect(reply.event).toBe('room_state');
    expect(reply.payload.players).toHaveLength(1);
  });

  it('removes the player from their previous room when joining another', async () => {
    const { clients } = await roomWith(['Alice', 'Bob']);
    const other = await server.createRoom();
    await clients[1].join(other, 'Bob');
    await clients[0].sync();
    expect(clients[0].last('participant_left')).toEqual({ participantId: clients[1].id });
  });

  it('broadcasts departures and promotes the next player when the facilitator disconnects', async () => {
    const { clients } = await roomWith(['Alice', 'Bob', 'Cy']);
    const [alice, bob, cy] = clients;
    const aliceId = alice.id; // read before closing: a closed socket has no id

    alice.close();
    const snapshot = await bob.next(['room_state']);
    await cy.sync();

    expect(bob.last('participant_left')).toEqual({ participantId: aliceId });
    expect(snapshot.payload.facilitatorId).toBe(bob.id);
    expect(snapshot.payload.players.map((p: { displayName: string }) => p.displayName)).toEqual(['Bob', 'Cy']);
    expect(cy.last('room_state').facilitatorId).toBe(bob.id);
  });
});

describe('voting', () => {
  it('never exposes vote values before the reveal', async () => {
    // Each voter picks a distinct word so a leak is unambiguous.
    const { code, clients } = await roomWith(['Alice', 'Bob', 'Cy'], {
      deckId: 'custom',
      customCards: ['aa', 'bb', 'cc'],
    });
    const [alice, bob, cy] = clients;
    alice.emit('cast_vote', { value: 'aa' });
    bob.emit('cast_vote', { value: 'bb' });
    cy.emit('cast_vote', { value: 'cc' });
    cy.emit('cast_vote', { value: 'aa' }); // changing a vote must not leak either
    for (const c of clients) await c.sync();

    // A player joining mid-round, and a facilitator promotion, both send fresh snapshots.
    const dee = await connect();
    const deeSnapshot = await dee.join(code, 'Dee');
    alice.close();
    await bob.next(['room_state']);
    await cy.sync();

    const own: Record<string, string> = { [bob.id]: 'bb', [cy.id]: 'aa' };
    for (const client of [bob, cy, dee]) {
      for (const { event, payload } of client.frames) {
        const json = JSON.stringify(payload);
        expect(json).not.toMatch(/"(votes|stats|value)"/);
        if (event === 'room_state') {
          // The only vote in a snapshot is the recipient's own (the deck also lists the card names).
          expect(payload.myVote ?? null).toBe(own[client.id] ?? null);
        } else {
          expect(json).not.toMatch(/"(aa|bb|cc)"/);
        }
      }
    }
    expect(deeSnapshot.payload.myVote).toBeNull();
    expect(bob.events('vote_cast').every((p) => Object.keys(p).sort().join() === 'hasVoted,participantId')).toBe(true);
  });

  it('broadcasts that someone voted, and lets them change their vote', async () => {
    const { clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;
    bob.emit('cast_vote', { value: '5' });
    bob.emit('cast_vote', { value: '8' });
    await bob.sync();
    await alice.sync();

    expect(alice.events('vote_cast')).toEqual([
      { participantId: bob.id, hasVoted: true },
      { participantId: bob.id, hasVoted: true },
    ]);
  });

  it('rejects cards outside the deck, observer votes and votes from non-members', async () => {
    const { code, clients } = await roomWith(['Alice']);
    const cy = await connect();
    await cy.join(code, 'Cy', { observer: true });
    const lurker = await connect();

    clients[0].emit('cast_vote', { value: '99' });
    cy.emit('cast_vote', { value: '5' });
    lurker.emit('cast_vote', { value: '5' });
    await clients[0].sync();
    await cy.sync();
    await lurker.sync();

    expect(clients[0].lastError()).toBe('invalid_vote');
    expect(cy.lastError()).toBe('observer_cannot_vote');
    expect(lurker.lastError()).toBe('not_in_room');
  });

  it('reveals votes and stats to everyone, and only on the facilitator’s request', async () => {
    const { clients } = await roomWith(['Alice', 'Bob', 'Cy']);
    const [alice, bob, cy] = clients;
    alice.emit('cast_vote', { value: '5' });
    bob.emit('cast_vote', { value: '13' });
    cy.emit('cast_vote', { value: '2' });
    for (const c of clients) await c.sync();

    bob.emit('reveal_votes');
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');
    expect(alice.events('votes_revealed')).toHaveLength(0);

    alice.emit('reveal_votes');
    alice.emit('reveal_votes'); // a second reveal is ignored
    for (const c of clients) await c.sync();

    for (const c of clients) {
      expect(c.events('votes_revealed')).toEqual([
        {
          votes: { [alice.id]: '5', [bob.id]: '13', [cy.id]: '2' },
          stats: { average: 6.67, median: 5, min: 2, max: 13 },
        },
      ]);
    }
  });

  it('rejects votes once revealed, and shows the results to late joiners', async () => {
    const { code, clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;
    alice.emit('cast_vote', { value: '3' });
    await alice.sync();
    alice.emit('reveal_votes');
    await alice.sync();

    bob.emit('cast_vote', { value: '5' });
    await bob.sync();
    expect(bob.lastError()).toBe('round_not_voting');

    const late = await connect();
    const snapshot = await late.join(code, 'Dee');
    expect(snapshot.payload).toMatchObject({
      phase: 'revealed',
      votes: { [alice.id]: '3' },
      stats: { average: 3, median: 3, min: 3, max: 3 },
    });
  });

  it('resets the round for everyone, only for the facilitator, and clears the story', async () => {
    const { clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;
    alice.emit('set_story', { story: 'PROJ-1' });
    bob.emit('cast_vote', { value: '5' });
    await bob.sync();
    await alice.sync();
    alice.emit('reveal_votes');
    await alice.sync();
    await bob.sync();
    bob.clear();

    bob.emit('reset_round');
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');
    expect(bob.events('round_reset')).toHaveLength(0);
    bob.clear();

    alice.emit('reset_round');
    await alice.sync();
    await bob.sync();
    expect(bob.frames.map((f) => f.event)).toEqual(['round_reset', 'story_changed']);
    expect(bob.last('story_changed')).toEqual({ story: '' });

    // Voting works again, and the old vote is gone.
    bob.emit('cast_vote', { value: '8' });
    await bob.sync();
    expect(bob.lastError()).toBeUndefined();
  });
});

describe('deck changes', () => {
  it('lets only the facilitator change the deck, validates it, and restarts the round', async () => {
    const { clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;
    bob.emit('cast_vote', { value: '5' });
    await bob.sync();
    bob.clear();

    bob.emit('change_deck', { deckId: 'tshirt' });
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');

    alice.emit('change_deck', { deckId: 'custom', customCards: ['x'] });
    await alice.sync();
    expect(alice.lastError()).toBe('invalid_deck');
    bob.clear();

    alice.emit('change_deck', { deckId: 'tshirt' });
    await alice.sync();
    await bob.sync();
    const snapshot = bob.last('room_state');
    expect(snapshot).toMatchObject({ deckId: 'tshirt', phase: 'voting', myVote: null });
    expect(snapshot.cards).toContain('XL');
    expect(snapshot.players.every((p: { hasVoted: boolean }) => !p.hasVoted)).toBe(true);

    bob.emit('cast_vote', { value: '5' }); // no longer in the deck
    await bob.sync();
    expect(bob.lastError()).toBe('invalid_vote');
  });
});

describe('kicking', () => {
  it('removes the target, tells them why, and tells everyone else', async () => {
    const { clients } = await roomWith(['Alice', 'Bob', 'Cy']);
    const [alice, bob, cy] = clients;

    bob.emit('kick_participant', { participantId: cy.id });
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');

    alice.emit('kick_participant', { participantId: alice.id });
    alice.emit('kick_participant', { participantId: 'nobody' });
    await alice.sync();
    expect(alice.events('error').map((e) => e.message)).toEqual(['invalid_participant', 'invalid_participant']);
    cy.clear();
    bob.clear();

    alice.emit('kick_participant', { participantId: cy.id });
    await alice.sync();
    await bob.sync();
    await cy.sync();

    expect(cy.events('error').map((e) => e.message)).toContain('kicked');
    expect(bob.last('participant_left')).toEqual({ participantId: cy.id });

    cy.emit('cast_vote', { value: '5' });
    await cy.sync();
    expect(cy.lastError()).toBe('not_in_room');
  });
});

describe('story', () => {
  it('is facilitator-only, trimmed, length-limited, broadcast, and in snapshots', async () => {
    const { code, clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;

    bob.emit('set_story', { story: 'x' });
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');

    alice.emit('set_story', { story: 'a'.repeat(101) });
    await alice.sync();
    expect(alice.lastError()).toBe('invalid_story');

    alice.emit('set_story', { story: '  PROJ-42 Login  ' });
    await alice.sync();
    await bob.sync();
    expect(bob.last('story_changed')).toEqual({ story: 'PROJ-42 Login' });

    const late = await connect();
    expect((await late.join(code, 'Dee')).payload.story).toBe('PROJ-42 Login');
  });
});

describe('facilitator transfer', () => {
  it('moves the role, tells everyone, and revokes the old facilitator’s powers', async () => {
    const { clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;

    bob.emit('transfer_facilitator', { participantId: alice.id });
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');

    alice.emit('transfer_facilitator', { participantId: alice.id });
    alice.emit('transfer_facilitator', { participantId: 'nobody' });
    await alice.sync();
    expect(alice.events('error').map((e) => e.message)).toEqual(['invalid_participant', 'invalid_participant']);
    alice.clear();

    alice.emit('transfer_facilitator', { participantId: bob.id });
    await alice.sync();
    await bob.sync();
    expect(alice.last('room_state').facilitatorId).toBe(bob.id);
    expect(bob.last('room_state').players.map((p: { isFacilitator: boolean }) => p.isFacilitator)).toEqual([
      false,
      true,
    ]);

    alice.emit('reveal_votes');
    await alice.sync();
    expect(alice.lastError()).toBe('not_authorised');
    bob.emit('reveal_votes');
    await bob.sync();
    await alice.sync();
    expect(alice.events('votes_revealed')).toHaveLength(1);
  });
});

describe('timer', () => {
  it('is facilitator-only, validated, broadcast, and visible to late joiners', async () => {
    const { code, clients } = await roomWith(['Alice', 'Bob']);
    const [alice, bob] = clients;

    bob.emit('start_timer', { seconds: 30 });
    await bob.sync();
    expect(bob.lastError()).toBe('not_authorised');

    alice.emit('start_timer', { seconds: 2 });
    alice.emit('start_timer', { seconds: '30' });
    await alice.sync();
    expect(alice.events('error').map((e) => e.message)).toEqual(['invalid_timer', 'invalid_timer']);

    alice.emit('start_timer', { seconds: 30 });
    await alice.sync();
    await bob.sync();
    expect(bob.last('timer_started')).toEqual({ remainingMs: 30_000 });

    const late = await connect();
    const snapshot = await late.join(code, 'Cy');
    expect(snapshot.payload.timer.remainingMs).toBeGreaterThan(25_000);
    expect(snapshot.payload.timer.remainingMs).toBeLessThanOrEqual(30_000);

    alice.emit('stop_timer');
    await alice.sync();
    await bob.sync();
    expect(bob.events('timer_stopped')).toHaveLength(1);
    expect((await late.join(code, 'Cy')).payload.timer).toBeNull();
  });

  it('is cleared by the reveal and can’t be started afterwards', async () => {
    const { code, clients } = await roomWith(['Alice']);
    const [alice] = clients;
    alice.emit('start_timer', { seconds: 30 });
    alice.emit('reveal_votes');
    await alice.sync();

    const late = await connect();
    expect((await late.join(code, 'Dee')).payload.timer).toBeNull();

    alice.emit('start_timer', { seconds: 30 });
    await alice.sync();
    expect(alice.lastError()).toBe('round_not_voting');
  });
});

describe('room expiry', () => {
  it('tells connected players, disconnects them, and forgets the room', async () => {
    const short = await startTestServer({ roomTtlMs: 150, cleanupIntervalMs: 50 });
    try {
      const code = await short.createRoom();
      const client = new TestClient(short.url);
      open.push(client);
      await client.ready();
      await client.join(code, 'Alice');

      const expired = await client.next(['error']);
      expect(expired.payload).toEqual({ message: 'room_expired' });
      await client.waitForDisconnect();

      const again = new TestClient(short.url);
      open.push(again);
      await again.ready();
      expect((await again.join(code, 'Alice')).payload).toEqual({ message: 'room_not_found' });
    } finally {
      await short.close();
    }
  });
});
