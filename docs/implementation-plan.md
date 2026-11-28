# Implementation Plan & Progress

Working plan for building Scrum Poker from [scrum-poker-prd.md](../scrum-poker-prd.md), one milestone per PR. This file is the source of truth for resuming work in a new session: read it, find the first milestone that isn't ✅, and continue from there.

## Status

| # | Milestone | PRD scope | Status | PR |
|---|---|---|---|---|
| 1 | Scaffold | Monorepo, shared types, Express + Socket.io, React + Vite, Railway config, i18next + 3 locales | ✅ Done | [#1](https://github.com/brianchung611/scrum-poker/pull/1) |
| 2 | Room lifecycle | Create room, join by code, live participant list, reconnection recovery | ✅ Done | [#3](https://github.com/brianchung611/scrum-poker/pull/3) |
| 3 | Voting core (**MVP**) | Card deck, private voting, facilitator reveal, stats, round reset | ✅ Done | [#4](https://github.com/brianchung611/scrum-poker/pull/4) |
| 4 | Polish | Round reset*, kick, mobile layout, deck selection, room expiry, language switcher UI* | ✅ Done | [#5](https://github.com/brianchung611/scrum-poker/pull/5) |
| 5 | P1 features | Observer mode, story name, facilitator transfer, timer | ✅ Done | [#6](https://github.com/brianchung611/scrum-poker/pull/6) |

\* Round reset is built in M3 (needed for a usable MVP loop). The language switcher already exists from M1. M4 covers what's left of the PRD's M4 row.

**Phase 1 (Milestones 1–5, everything in the PRD's milestone table) is complete.** The next work is **[Phase 2: Hardening & Launch](./phase-2-plan.md)**: automated tests + CI, deployment prep, persistent player identity, abuse limits (in that order). Read that file to resume; it has its own status table.

## Workflow rules

- **One branch + one PR per milestone**, named `milestone-N-<slug>` (e.g. `milestone-2-room-lifecycle`), cut from an up-to-date `main`.
- **Sequential, merge-as-we-go**: open the PR, then stop and wait for the user to review/merge. Never merge it yourself unless told to. Branch the next milestone only after the previous one is merged.
- Never push directly to `main` (the single bootstrap commit of the PRD was the one-off exception).
- `gh` CLI is installed and authenticated as `brianchung611`; use `gh pr create`.
- Verify each milestone end-to-end before opening the PR: `npm run build`, then run the app via `.claude/launch.json` (`backend` on :4000, `frontend` on :5173) and exercise the flow in the browser preview with two clients. No automated test framework has been added; manual verification is the agreed approach.
- PR body: Summary, Notes (call out deliberate simplifications), Test plan checklist.
- **Screenshots**: attach them for major UI changes (new pages/components, notable layout or visual changes); skip only for wording or minor position tweaks. `gh` can't upload images, so commit them to the orphan `pr-assets` branch (one folder per milestone, e.g. `m3/`, via a scratch clone of that branch) and embed `https://raw.githubusercontent.com/brianchung611/scrum-poker/pr-assets/<folder>/<file>` links in a PR comment. Check the URLs return 200 first.

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

## Current codebase (after M5)

```
packages/
  shared/    decks.ts (presets, custom-deck validation, resolveDeck), types.ts (Locale, Player, RoomState incl. myVote/votes/stats, VoteStats, CreateRoomResponse, limits…), events.ts (CLIENT_EVENTS / SERVER_EVENTS + payload types)
  backend/   index.ts (Express: /health, POST /api/rooms; Socket.io), rooms.ts (in-memory Map<code, Room>, add/remove player,
             facilitator promotion, castVote/revealVotes/resetRound/changeDeck, setStory, transferFacilitator, start/stopTimer, expireRooms, toRoomState(room, myId)), roomCode.ts, stats.ts, cleanup.ts,
             socketHandlers.ts (join_room, cast_vote, reveal_votes, reset_round, change_deck, kick_participant, set_story, transfer_facilitator, start_timer, stop_timer, disconnect)
  frontend/  App.tsx (BrowserRouter, Suspense), pages/{HomePage,RoomPage}, components/{Header,LanguageSwitcher,NameForm,ParticipantList},
             components/{CardDeck,RoundControls,VoteStats,DeckPicker,DeckSettings,StoryPanel,TimerPanel}, store/useRoomStore.ts (Zustand + joinRoom(code, name) → cleanup fn,
             castVote/revealVotes/resetRound), socket/socket.ts, api.ts, session.ts (sessionStorage name),
             i18n.ts, public/locales/{en,zh-TW,zh-CN}/{common,game}.json
railway.json, .claude/launch.json, tsconfig.base.json (strict, Bundler resolution)
```

### M2 implementation notes

- Server errors are language-agnostic codes in `{ message }` (`room_not_found`, `invalid_display_name`); the frontend translates them via `common:errors.<code>`. Add new codes to all 3 `common.json` files.
- `joinRoom()` in the store re-emits `join_room` on every socket `connect`, which is how reconnects recover. A server restart wipes rooms, so a reconnect then shows "room not found" (expected; rooms are ephemeral).
- The room store only mutates local state from server events; M3 should follow the same pattern (emit → wait for broadcast → update).
- Player id == `socket.id`. A refresh gets a new id, so a refreshed facilitator rejoins as a normal participant (the promoted player keeps the role). Acceptable per the no-auth design; revisit with M5 facilitator transfer.
- Empty rooms are kept (so a lone player can refresh and rejoin) until M4's TTL cleanup removes them.
- Production hosting of the frontend needs an SPA fallback (all paths → `index.html`) because of `/room/:code`.

## Gotchas learned in M1

- Frontend relative imports must **omit** file extensions (`./App`, not `./App.tsx`); tsconfig doesn't enable `allowImportingTsExtensions`.
- Backend is `NodeNext` ESM, so its relative imports **need** `.js` extensions. `shared` also uses `.js` extensions in its relative imports.
- `@scrum-poker/shared` resolves through its built `dist/`. Root `postinstall` and `predev` now build it, but if you change shared while the dev servers run (or start a single package via `.claude/launch.json`), re-run `npm run build -w @scrum-poker/shared`.
- Root `npm run build` builds shared → backend → frontend in order.

### M3 implementation notes

- `RoomState` gained `myVote` (the recipient's own vote, private to them). `votes`/`stats` are only ever in a snapshot or event once `phase === 'revealed'`; the UI also never renders a value before reveal (the flip card's front face is empty).
- Server error codes added: `not_authorised`, `invalid_vote`, `round_not_voting`, `not_in_room`. The store treats `room_not_found` / `invalid_display_name` as fatal (full-page error) and everything else as a transient `notice` banner (4s).
- `castVote` updates the player's own `myVote` optimistically; everything else only changes from server events.
- Outliers: the highest and lowest numeric votes are highlighted when ≥3 numeric votes were cast and min ≠ max (computed client-side from `stats`).
- Votes of players who leave are kept once the round is revealed (so published stats stay consistent) and dropped if they leave mid-voting. Consequence: a player who refreshes after the reveal rejoins as a new player with no vote, while their old vote still counts in the stats (no-auth limitation).
- The facilitator can click New round at any time, including mid-voting (clears all votes).
- Reveal requires at least one vote (button disabled otherwise; the server doesn't enforce this).

### M4 implementation notes

- **Decks**: `fibonacci`, `tshirt`, `powers_of_2`, `custom` (see `packages/shared/src/decks.ts`). `RoomState.cards` is the resolved card list; clients render that, never a lookup by `deckId`. Custom decks: 2–20 unique cards, ≤5 chars each, comma-separated; validated by the same shared `normalizeCustomCards` on client and server (`POST /api/rooms` returns 400 `invalid_deck`).
- **Changing the deck** (`change_deck`, facilitator-only) also resets the round, then sends everyone a fresh `room_state` (no new server event). The UI is a `<details>` "Change deck" under the card deck, with a warning that votes are cleared.
- **Non-numeric decks** (T-shirt, custom words) have no average, so `VoteStats` shows a per-card tally instead of the four stat tiles.
- **Kick** (`kick_participant`, facilitator-only): can't kick yourself; the target gets error `kicked` (fatal page, and the client disconnects its socket so it can't silently auto-rejoin), then the server runs the normal leave path (`participant_left`). There's no ban: a kicked player who refreshes or reopens the link can rejoin. The UI asks for a `window.confirm` first.
- **Room expiry**: `cleanup.ts` sweeps every `ROOM_CLEANUP_INTERVAL_SECONDS` (default 60) and deletes rooms idle for `ROOM_TTL_MINUTES` (default 120, fractions allowed for testing). Activity = anything that calls `touch()` (join, leave, vote, reveal, reset, deck change). Connected players of an expired room get error `room_expired` and are disconnected. This also removes empty rooms, which M2 kept around.
- New error codes in all 3 `common.json`: `invalid_deck`, `invalid_participant`, `kicked`, `room_expired`.
- Mobile/responsive and the language switcher were already in place from M1–M3, so M4 only verified them with the new controls.
- Gotcha: editing frontend files while several tabs are open makes Vite live-reload them all, so every client rejoins (the first to reconnect becomes facilitator). Don't edit code mid-way through a multi-tab manual test.

### M5 implementation notes

- **Observer mode**: chosen with a checkbox when creating/joining (and on the shared-link name prompt); `join_room` carries `observer`, stored in `sessionStorage` so a refresh keeps the role. Observers don't vote (`observer_cannot_vote`), aren't counted in "Waiting for votes (x/y)", see no deck, and get an Observer badge. There is no in-room toggle (rejoin to change roles). An observer can still be (or become) facilitator.
- **Story name**: facilitator-only (`set_story`, max 100 chars), broadcast as `story_changed`, included in `room_state`. It is cleared by **New round** (a stale label would silently mislead) but kept across deck changes and reveals.
- **Facilitator transfer**: `transfer_facilitator` (facilitator-only; not self; target must be in the room); the server resends `room_state` to everyone. ★ button per participant with a confirm.
- **Timer**: facilitator starts one of 30s / 1m / 2m / 5m (`start_timer`, any integer 5–600 s accepted by the server) during voting; server stores `timerEndsAt` and sends **remaining ms** (not a timestamp) so client clocks don't matter; clients count down locally. It is advisory: nothing auto-reveals at 0 ("Time's up!"). Cleared by reveal, new round, deck change and `stop_timer`. Snapshots carry `timer.remainingMs`, so late joiners see it.
- New error codes in all 3 `common.json`: `observer_cannot_vote`, `invalid_story`, `invalid_timer`.
- Participant rows have a fixed min-height so observer rows (no card slot) line up.

## Milestone 2 — Room lifecycle (built; plan kept for reference)

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

See [phase-2-plan.md](./phase-2-plan.md) for the planned follow-up work and the list of ideas beyond it. The limitations noted above (a refreshed player rejoins as a new player, a kicked player can rejoin, no automated tests, nothing deployed) are addressed by Phase 2.
