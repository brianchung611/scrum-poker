# Implementation Plan & Progress

Working plan for building Scrum Poker from [scrum-poker-prd.md](../scrum-poker-prd.md), one milestone per PR. This file is the source of truth for resuming work in a new session: read it, find the first milestone that isn't ✅, and continue from there.

## Status

| # | Milestone | PRD scope | Status | PR |
|---|---|---|---|---|
| 1 | Scaffold | Monorepo, shared types, Express + Socket.io, React + Vite, Railway config, i18next + 3 locales | ✅ Done | [#1](https://github.com/brianchung611/scrum-poker/pull/1) |
| 2 | Room lifecycle | Create room, join by code, live participant list, reconnection recovery | ⬜ Next | — |
| 3 | Voting core (**MVP**) | Card deck, private voting, facilitator reveal, stats | ⬜ | — |
| 4 | Polish | Round reset*, kick, mobile layout, deck selection, room expiry, language switcher UI* | ⬜ Deferred | — |
| 5 | P1 features | Observer mode, story name, facilitator transfer, timer | ⬜ Deferred | — |

\* Round reset is built in M3 (needed for a usable MVP loop). The language switcher already exists from M1. M4 covers what's left of the PRD's M4 row.

Agreed scope for the current effort is **Milestones 1–3**. M4–5 are deferred until the user asks for them.

## Workflow rules

- **One branch + one PR per milestone**, named `milestone-N-<slug>` (e.g. `milestone-2-room-lifecycle`), cut from an up-to-date `main`.
- **Sequential, merge-as-we-go**: open the PR, then stop and wait for the user to review/merge. Never merge it yourself unless told to. Branch the next milestone only after the previous one is merged.
- Never push directly to `main` (the single bootstrap commit of the PRD was the one-off exception).
- `gh` CLI is installed and authenticated as `brianchung611`; use `gh pr create`.
- Verify each milestone end-to-end before opening the PR: `npm run build`, then run the app via `.claude/launch.json` (`backend` on :4000, `frontend` on :5173) and exercise the flow in the browser preview with two clients. No automated test framework has been added; manual verification is the agreed approach.
- PR body: Summary, Notes (call out deliberate simplifications), Test plan checklist.

## Decisions already made (don't re-litigate)

- **Room creation is REST**: `POST /api/rooms` → `{ roomCode }` (PRD §6.1 "minimal REST endpoints"). Joining, including the creator's first join, is the `join_room` socket event; the first joiner becomes facilitator.
- **No `GET /api/rooms/:code`**: the join form navigates straight to `/room/:code` and relies on the socket `error` event ("room not found"), keeping to the PRD §6.3 contract.
- **Room codes**: 6-char uppercase alphanumeric via `nanoid` `customAlphabet`, excluding ambiguous characters (0/O/1/I).
- **Deck**: only the default Fibonacci deck (`0,1,2,3,5,8,13,21,?,☕`, defined in `packages/shared/src/types.ts`) through M3. There is no deck chooser until M4, even though PRD §4.1 mentions picking a deck at creation. Call this out in the M2/M3 PR notes.
- **Stats** ignore non-numeric cards (`?`, `☕`).
- **Vote secrecy**: `vote_cast` only ever carries `hasVoted: true`; values are sent only in `votes_revealed`.
- **Facilitator authority**: check `socket.id === room.facilitatorId` server-side for `reveal_votes` / `reset_round`; emit `error` otherwise.
- **Facilitator leaves**: auto-promote the earliest remaining participant so the room isn't stranded (not the P1 manual transfer feature).
- **Reconnection**: server always replies to `join_room` with a full `room_state`. Frontend keeps `{ roomCode, displayName }` in `sessionStorage` so a refresh silently rejoins.
- **Room expiry (TTL cleanup)** is M4; keep a `lastActivity` timestamp on the room model so it's a small addition later.
- **Railway**: config only (`railway.json`); not deployed, no credentials available.

## Current codebase (after M1)

```
packages/
  shared/    types.ts (Locale, DECKS, Player, RoomState, VoteStats…), events.ts (CLIENT_EVENTS / SERVER_EVENTS + payload types), index.ts
  backend/   src/index.ts — Express + cors, GET /health, Socket.io server (no handlers yet)
  frontend/  Vite + React 18 + TS; i18n.ts (http-backend, lazy namespaces, localStorage detection);
             components/LanguageSwitcher.tsx; App.tsx is a placeholder home page;
             public/locales/{en,zh-TW,zh-CN}/{common,game}.json
railway.json, .claude/launch.json, tsconfig.base.json (strict, Bundler resolution)
```

Dependencies for later milestones are already installed (`react-router-dom`, `zustand`, `socket.io-client`) but unused so far. `nanoid` still needs adding to the backend.

## Gotchas learned in M1

- Frontend relative imports must **omit** file extensions (`./App`, not `./App.tsx`); tsconfig doesn't enable `allowImportingTsExtensions`.
- Backend is `NodeNext` ESM, so its relative imports **need** `.js` extensions. `shared` also uses `.js` extensions in its relative imports.
- `@scrum-poker/shared` resolves through its built `dist/`. Backend and frontend only see shared type/constant changes after `npm run build -w @scrum-poker/shared`. M1 didn't import shared at runtime in the backend, so this wasn't hit yet; M2 will. Consider a `predev` step (or building shared at the start of `npm run dev`) in M2 so dev doesn't silently use stale shared code.
- Root `npm run build` builds shared → backend → frontend in order.

## Milestone 2 — Room lifecycle (next)

**Backend**
- `rooms.ts`: in-memory `Map<roomCode, Room>` (players, facilitatorId, deckId, phase, `lastActivity`) with helpers to create/get/add/remove players and produce a per-recipient `RoomState` snapshot (`myId` = that socket's id).
- `roomCode.ts`: generator per decisions above; retry on collision.
- `POST /api/rooms` in `index.ts` → creates an empty room with the default deck, returns `{ roomCode }`.
- `socketHandlers.ts` registered from `index.ts` on `connection`:
  - `join_room` `{ roomCode, displayName }`: validate (room exists, non-empty trimmed name, reasonable max length), add player (first joiner = facilitator), `socket.join(roomCode)`, reply `room_state` to the joiner, broadcast `participant_joined` to the rest of the room. Unknown room → `error` event.
  - `disconnect`: remove player, broadcast `participant_left`, auto-promote a new facilitator if needed (and send updated `room_state` so clients see it).

**Frontend**
- `socket/socket.ts`: singleton `socket.io-client` using `VITE_SOCKET_URL` (default `http://localhost:4000`); REST base URL derived from the same env var.
- `store/useRoomStore.ts` (Zustand): room state, connection/error state, actions that wrap socket emits; socket listeners update the store.
- Routing in `App.tsx` via `react-router-dom`: `/` → `HomePage`, `/room/:code` → `RoomPage`.
- `HomePage`: "Create room" (display name → `POST /api/rooms` → navigate) and "Join room" (display name + code → navigate). Store display name in `sessionStorage` before navigating. Keep `LanguageSwitcher` in the header on every page.
- `RoomPage`: connect, emit `join_room` (from `sessionStorage`, prompting for a name if absent, e.g. when opening a shared link), show room code + copy-link button, live `ParticipantList` (facilitator badge, join/leave updates), and a clear "room not found" state linking back home.
- Add `common.json` keys (all 3 locales) for the new strings; avoid hard-coded English widths.

**Verify**: two browser clients — create in A, join via link in B, both see live participant updates; refresh B and confirm it rejoins with the same name and current state; bogus room code shows the error; facilitator leaving promotes the next player.

**Branch/PR**: `milestone-2-room-lifecycle`.

## Milestone 3 — Voting core (MVP)

**Backend**
- `stats.ts`: average, median, min, max over numeric votes only; `null` fields when no numeric votes.
- Handlers: `cast_vote` `{ value }` (value must be in the room's deck, phase must be `voting`; storing a new value replaces the old one, so votes are changeable before reveal; broadcast `vote_cast` with `hasVoted: true` only), `reveal_votes` (facilitator-only; set phase `revealed`, broadcast `votes_revealed` with `votes` + `stats`), `reset_round` (facilitator-only; clear votes/`hasVoted`, phase → `voting`, broadcast `round_reset`).
- `room_state` snapshots must **never** include vote values while `phase === 'voting'`; include `votes`/`stats` only when revealed (so a rejoin after reveal shows the results).

**Frontend**
- `CardDeck` (keyboard-navigable, touch-friendly, selected-card highlight, disabled after reveal).
- `ParticipantList`: ✓ for voted / face-down card pre-reveal; value after reveal; outliers highlighted.
- Facilitator-only controls: vote count ("Waiting for votes (x/y)") with Reveal, and "New round" after reveal.
- `VoteStats` (average/median/min/max) shown after reveal.
- Store: `phase`, `votes`, `stats`, `myVote`, plus actions for cast/reveal/reset; clear `myVote` on `round_reset`.
- `game.json` keys for all 3 locales (PRD §5.5 has the starting set; add whatever else the UI needs).

**Verify**: two clients (facilitator + participant): cast votes → only checkmarks visible, no values in WS frames; reveal flips both simultaneously with correct stats; non-facilitator reveal/reset attempts return `error`; New round clears both; rejoin after reveal shows results.

**Branch/PR**: `milestone-3-voting-core`. Merging this completes the MVP.

## Later (not yet scheduled)

- **M4 Polish**: deck selection (Fibonacci / T-shirt / powers of 2 / custom) at creation and changeable by the facilitator, kick participant, mobile-responsive pass, room TTL cleanup (~2h inactivity, `setInterval` sweep), any remaining switcher/layout polish.
- **M5 P1 features**: observer mode, story name field, facilitator transfer, countdown timer.
- Out of scope for v1 per the PRD: vote history, accounts, Jira/Linear integration, native mobile, self-hosting.
