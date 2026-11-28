# Phase 2 Plan: Hardening & Launch

Phase 1 (Milestones 1–5, see [implementation-plan.md](./implementation-plan.md)) built every feature in the PRD. Phase 2 makes it safe to change, deployable, resilient to flaky connections, and hard to abuse. It is four tasks, **in this order**, one branch + one PR each. The workflow rules in `implementation-plan.md` still apply (sequential, wait for the user to merge, never push to `main`, screenshots for major UI changes, PR body with Summary / Notes / Test plan, add the PR link to the status table).

## Status

| # | Task | Branch | Status | PR |
|---|---|---|---|---|
| P2-1 | Automated tests + CI | `phase2-1-tests-ci` | ⬜ Next | — |
| P2-2 | Deployment prep | `phase2-2-deployment` | ⬜ | — |
| P2-3 | Persistent player identity | `phase2-3-player-identity` | ⬜ | — |
| P2-4 | Abuse limits | `phase2-4-abuse-limits` | ⬜ | — |

Why this order: tests and CI first so the riskiest change (P2-3, which reworks how players are identified everywhere) lands with a safety net; deployment prep second because it's mostly config and unblocks the user's own account setup in parallel; abuse limits last because they're small and best tuned against the final protocol.

When a task is done, update the table here (✅ + PR link) in that task's PR.

---

## P2-1: Automated tests + CI

**Goal:** every PR is built, typechecked and tested automatically, and the behaviors verified by hand so far are locked in as tests.

**Decisions**
- **Vitest** at the repo root (one `npm test`, plus per-package `test` scripts). It handles TypeScript and ESM without extra config. Pin it as a root devDependency.
- **Test layers**
  1. *shared*: `decks.ts` (`normalizeCustomCards`, `splitCustomCards`, `resolveDeck`, including `__proto__`, duplicates, length, count limits).
  2. *backend unit*: `stats.ts` (numeric-only, even/odd median, no numeric votes → nulls) and the pure `rooms.ts` logic (`castVote` rules, `revealVotes`, `resetRound` story/timer handling, `changeDeck`, `transferFacilitator`, `startTimer` validation, facilitator promotion on `removePlayer`, `expireRooms`, `toRoomState` never including votes before reveal).
  3. *backend integration*: start the real Express + Socket.io server on port 0 and drive it with `socket.io-client` (add as a backend **devDependency**). Port the ad-hoc scripts used in M2–M5: join/leave, vote secrecy (no `votes`/`value`/`stats` in any pre-reveal frame, including a mid-round joiner's snapshot), facilitator-only events → `not_authorised`, deck change, kick, expiry with a tiny TTL, story/timer/transfer/observer rules.
  4. *frontend* (small): pure helpers only (e.g. `isDeckChoiceValid`/`customCardsOf`, the outlier rule, store event handlers against a mocked socket). Component/DOM tests (`@testing-library/react` + `jsdom`) only if cheap; browser E2E (Playwright) is explicitly **out of scope** here.
- **Testability refactor of the backend** (no behavior change): split `src/index.ts` into `createApp()` / `createServer({ port, corsOrigin, ttl… })` returning `{ httpServer, io, close }` and a thin `index.ts` that reads env and listens. Add a test-only `resetRooms()` export in `rooms.ts` (rooms are a module-level `Map`). Tests must run in isolation and be deterministic: use fake timers or tiny TTLs instead of real waits where possible.
- **CI**: `.github/workflows/ci.yml`, triggers `pull_request` and `push` to `main`. Node 22, `actions/setup-node` with npm cache, `npm ci` (the root `postinstall` builds `shared`), then `npm run build`, `npm run typecheck`, `npm test`. One job, under ~3 minutes.
- Add a root `test` script and a "Testing" section to the README. Update the workflow rules in `implementation-plan.md`: tests now exist, new behavior needs tests, and CI must be green before asking for a merge.

**Out of scope:** coverage thresholds, Playwright, any behavior change.

**Done when:** `npm test` passes locally and in CI; the CI check shows on the PR; deliberately breaking a rule (e.g. let `cast_vote` leak a value) makes a test fail (check this once, then revert).

**User action afterwards (optional):** in the GitHub repo settings, require the CI check on `main` (branch protection). Claude can't do that without admin rights it shouldn't assume.

---

## P2-2: Deployment prep

**Goal:** everything needed so the user can deploy in ~15 minutes with their own accounts. **Claude does not deploy**: it has no Railway/Vercel/Cloudflare credentials and must not ask for them in chat. Deliver config + a precise guide, and verify the production build locally.

**Decisions**
- **Backend on Railway** (already chosen in the PRD, `railway.json` exists). Review and harden it: confirm the build/start commands work from a clean checkout, `healthcheckPath` is `/health`, and **a single instance** is required (rooms are in memory; document why horizontal scaling breaks it, per PRD §7).
- **Frontend as static site** on Vercel or Cloudflare Pages (both free). Provide SPA fallback config for both because deep links like `/room/ABC123` must serve `index.html`: `packages/frontend/vercel.json` (rewrites) and `packages/frontend/public/_redirects` (`/* /index.html 200`). Document build settings (root dir `packages/frontend`, build command that also builds `shared`, output `dist`). Note `VITE_SOCKET_URL` is baked in **at build time**, so changing the backend URL needs a rebuild.
- **CORS**: `CORS_ORIGIN` currently accepts one origin. Allow a comma-separated list (e.g. production + a Vercel preview URL) in both Express `cors` and Socket.io; keep the default `http://localhost:5173`. Cover it with a test (after P2-1).
- **`trust proxy`**: set `app.set('trust proxy', 1)` when running behind Railway so client IPs are correct (needed by the P2-4 rate limits); gate it by env (`TRUST_PROXY`) rather than hard-coding.
- **Docs**: `docs/deployment.md` with: architecture diagram (frontend static host ↔ Railway service, WebSocket over `wss`), the exact env vars for each side (`NODE_ENV`, `PORT` (Railway injects it), `CORS_ORIGIN`, `ROOM_TTL_MINUTES`, `ROOM_CLEANUP_INTERVAL_SECONDS`, `TRUST_PROXY`; `VITE_SOCKET_URL`), click-by-click steps for Railway and one frontend host, a post-deploy smoke-test checklist (health URL, create a room, join from a phone, language switch, reveal), rollback, and cost (~$5/month per the PRD). Link it from the README and replace the thin README "Deployment" blurb.
- Optional, only if trivial: a `Dockerfile`. Skip if Nixpacks works; don't maintain two build paths.

**Verification (local, production-like):** `npm run build`, run the backend with `NODE_ENV=production` and a non-default `PORT`/`CORS_ORIGIN`, serve the built frontend with `vite preview` (or any static server) pointed at it via `VITE_SOCKET_URL`, and walk through create → join → vote → reveal in the browser, including opening a `/room/CODE` deep link directly and a cross-origin request being rejected for a non-allowed origin.

**Out of scope:** actually deploying, custom domains, CI-driven deploys, monitoring.

**User actions after merge:** create the Railway project from the GitHub repo and set env vars; create the frontend project and set `VITE_SOCKET_URL`; set Railway's `CORS_ORIGIN` to the frontend URL; run the smoke-test checklist. Claude can help interpret errors if the user pastes logs.

---

## P2-3: Persistent player identity

**Problem today:** a player is identified by `socket.id`. Any reconnect (network blip, laptop sleep, phone switching networks, refresh) produces a new id, so the server treats them as a new person: the **facilitator loses the role** (promoted to someone else), their **vote is dropped** mid-round (or, after a reveal, their old vote lingers in the stats with no owner), and a **kicked player can simply rejoin**.

**Design**
- **Two ids per player.** `playerId` is public (what other clients see in `participantId`, vote keys, `facilitatorId`, `myId`); it is generated by the server on first join and **no longer equals `socket.id`**. A client-generated random **`playerToken`** (`crypto.randomUUID()`, kept in `sessionStorage` per tab next to the display name) is the secret used to reclaim that player. Never broadcast tokens. Store them server-side only (`Room.tokens: Map<token, playerId>`).
- **Join/rejoin.** `join_room` payload gains `playerToken`. If the token maps to an existing player in the room, **rebind** that player to the new socket (restore role, vote, observer flag; reply with the normal full `room_state`; cancel any pending removal). Otherwise create a new player. If the previous socket is still connected, tell it (`error: replaced`) and disconnect it so one token = one live socket.
- **Grace period.** On socket disconnect, don't remove the player: mark `connected: false` and start a timer (`PLAYER_GRACE_SECONDS`, default 60). If they don't rebind in time, run the existing removal path (`participant_left`, facilitator auto-promotion, mid-voting vote drop). Players still count in "(x/y)" during grace, and the facilitator role is **not** transferred during grace.
- **Intentional leave.** New client→server `leave_room`, sent when the room page unmounts (Back to home, navigating away), removes the player immediately (no grace). Closing the tab can't send it, so grace covers that case.
- **Kick sticks (softly).** Remember kicked tokens per room (`Room.kicked: Set<token>`); a rejoin with a kicked token gets `kicked`. Clearing site data or a new tab (new `sessionStorage`) bypasses it; that's accepted, there are no accounts. Say so in the docs.
- **Protocol/type changes.** `Player` gains `connected: boolean`; new server→client `participant_status { participantId, connected }` (or fold into existing events, but keep clients from needing a full snapshot for each blip); `JoinRoomPayload.playerToken`; new `leave_room`; error codes `replaced`, and reuse `kicked`. `socket.data` holds `{ roomCode, playerId }`; targeted emits (`sendRoomState`, kick notice) must look up the player's **current socket id** instead of using the player id as a socket room name.
- **Frontend.** Generate/persist the token (`session.ts`), send it in `join_room`, handle `participant_status`, render a clear "reconnecting…" state on a disconnected participant (dimmed row + small badge; keep rows the same height), and send `leave_room` in the `joinRoom` cleanup. The existing "reconnecting" banner and auto re-emit of `join_room` on `connect` already provide the client half of recovery.
- **Edge cases to handle and test:** facilitator refresh keeps the role and its controls; a voter's vote and `hasVoted` survive a reconnect (`myVote` comes from the snapshot); reconnect after reveal keeps a single vote per person (no ghost vote); two tabs with the same token; token for a room that expired; grace expiry while the facilitator is disconnected promotes the next player; `kick` removes immediately (no grace); room TTL cleanup still removes rooms with disconnected players.

**Verification:** extend the P2-1 integration tests (reconnect within and after grace, kicked token denied, `leave_room`, replaced socket, secrecy still holds, tokens never appear in any frame). Browser: refresh the facilitator tab mid-round and confirm role, vote and controls survive; stop/start the backend briefly and confirm clients show "reconnecting" then recover (note: a backend restart still wipes rooms, by design). Screenshots required (new disconnected-participant UI).

**Out of scope:** accounts/auth, persistence across server restarts, an in-room observer toggle.

**Docs to update:** `implementation-plan.md` notes that currently describe the refresh limitations (M2, M3, M4 notes) should be marked resolved.

---

## P2-4: Abuse limits

**Problem today:** `POST /api/rooms` is open and rooms live in memory, so a script can create unlimited rooms/players and exhaust memory; sockets have no event rate limits; request bodies/payloads use library defaults.

**Decisions** (all limits configurable by env with sane defaults; document them in `.env.example` and `docs/deployment.md`)
- **Room creation rate limit** per client IP (e.g. 10/min) on `POST /api/rooms`, using `express-rate-limit`; return `429 { error: 'rate_limited' }`. Requires correct client IPs behind Railway (`TRUST_PROXY` from P2-2).
- **Global caps:** `MAX_ROOMS` (default 1000) → `POST /api/rooms` returns `503 { error: 'server_busy' }`; `MAX_PLAYERS_PER_ROOM` (default 50) → `join_room` gets `error: room_full` (observers count; rejoining with a valid token must still succeed, which depends on P2-3).
- **Payload limits:** `express.json({ limit: '10kb' })`; Socket.io `maxHttpBufferSize` (e.g. 10 kB). Existing field limits (name 30, story 100, custom cards 20×5, timer 5–600 s) stay.
- **Per-socket event rate limit** (simple token bucket, e.g. ~20 events/s burst, ~10/s sustained): exceeding it returns `error: rate_limited` and drops the event; persistent abuse (e.g. 100 violations) disconnects the socket. Must not trip on normal use (rapid card changes, the timer, many players voting at once).
- **Frontend:** translate the new error codes (`rate_limited`, `server_busy`, `room_full`) in all three `common.json` files; `room_full` and `server_busy` are fatal-style messages on the join/create flow, `rate_limited` is a transient notice. Check that the create form shows a friendly message when the API returns 429/503 (today any non-OK shows the generic "couldn't create the room").
- Keep it proportionate: this is a tool for teams, not a public API. No CAPTCHA, no IP blocklists, no external store (single instance, in-memory counters are fine).

**Verification:** tests for each limit (burst over the rate limit → 429 then recovery after the window; room cap; room_full; oversized body rejected; socket flood gets rate-limited, normal usage doesn't); manual check of the frontend messages in one language plus zh-TW strings present.

**Out of scope:** authentication, distributed rate limiting, monitoring/alerting.

---

## Later (after Phase 2)

Not planned, only ideas: an in-room observer/voter toggle, a styled confirm dialog instead of `window.confirm`, an accessibility audit (contrast, screen readers), browser E2E tests (Playwright), a clean browser-console check on every UI PR, extra deck presets. Still out of scope per the PRD: vote history, accounts, Jira/Linear integration, native mobile, self-hosting.
