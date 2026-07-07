# Scrum Poker
## Product Requirements Document

**Version:** 1.0 — MVP
**Status:** Draft
**Date:** June 2026

---

## 1. Overview

Scrum Poker is a real-time, browser-based planning poker tool for agile teams. It enables remote or co-located teams to estimate story points collaboratively in a structured, bias-free format. Each participant votes privately, then all votes are revealed simultaneously to surface estimation spread and prompt discussion.

| | |
|---|---|
| **Problem** | Existing tools are either paywalled, overly complex, or require account sign-up. Teams need a frictionless, shareable room they can spin up in seconds. |
| **Solution** | A no-login, link-shareable planning poker room with real-time sync, built on WebSockets. No database, no accounts — just create a room and share the link. |
| **Target users** | Software engineering teams doing sprint planning, backlog refinement, or ad-hoc estimation sessions. |
| **Non-goals (v1)** | Vote history, account system, Jira/Linear integration, mobile native app, self-hosted deployment. |

---

## 2. User Roles

### 2.1 Facilitator

The person who creates the room. Has exclusive control over game flow.

- Creates the room and shares the link/code
- Selects and changes the card deck
- Triggers the reveal
- Resets the round for the next story
- Can kick participants

### 2.2 Participant

Any person who joins via the room link or code. Can only vote.

- Joins by entering display name — no account required
- Selects a card during the voting phase
- Can change their vote before reveal
- Sees all votes after reveal

---

## 3. Features & Scope

P0 = must-have for MVP launch. P1 = strong follow-on. P2 = future consideration.

| Feature | Priority | MVP | Notes |
|---|---|---|---|
| Room creation | P0 | Yes | Short alphanumeric code generated server-side |
| Join by code or link | P0 | Yes | No login required, display name only |
| Card deck selection | P0 | Yes | Fibonacci, T-shirt, powers of 2, custom |
| Real-time participant list | P0 | Yes | Shows who has voted (not the value) |
| Private voting | P0 | Yes | Votes hidden until facilitator reveals |
| Simultaneous reveal | P0 | Yes | All cards shown at the same moment |
| Vote statistics | P0 | Yes | Average, median, min/max on reveal |
| Round reset | P0 | Yes | Clears votes, returns to voting phase |
| Facilitator controls | P0 | Yes | Reveal and reset restricted to facilitator |
| Reconnection recovery | P0 | Yes | Rejoin returns full current room state |
| Presence awareness | P0 | Yes | Show join/leave events in participant list |
| Localization | P0 | Yes | English (default), Traditional Chinese, Simplified Chinese |
| Observer mode | P1 | No | Join without voting (e.g. PM, stakeholder) |
| Story name field | P1 | No | Label the current round for context |
| Facilitator transfer | P1 | No | Hand off facilitator role mid-session |
| Timer | P1 | No | Countdown to encourage timely voting |
| Vote history | P2 | No | Requires database — explicitly out of scope for v1 |
| Jira / Linear integration | P2 | No | Import stories from issue tracker |

---

## 4. Core User Flows

### 4.1 Create a room (Facilitator)

- Land on homepage → click "Create room"
- Enter display name → select card deck → click "Start"
- Server generates a short room code (e.g. XKCD-42) and a shareable URL
- Facilitator lands in the room lobby — can copy link to share

### 4.2 Join a room (Participant)

- Visit the shared URL or enter room code on homepage
- Enter display name → click "Join"
- Lands in the room — sees participant list and card deck

### 4.3 Voting round

- All participants see the card deck (e.g. 1, 2, 3, 5, 8, 13, ?, ☕)
- Each participant selects a card — their row shows a face-down card to others
- Participant list shows a check mark next to those who have voted
- Facilitator sees a count of votes cast vs total participants
- Facilitator clicks "Reveal" — all cards flip simultaneously for everyone

### 4.4 Post-reveal

- All votes displayed with participant names
- Statistics shown: average, median, min, max, and any outliers highlighted
- Facilitator clicks "New round" to reset — all cards hidden, votes cleared

---

## 5. Localization

### 5.1 Overview

The app supports three languages at launch. English is the default. Language preference is stored in `localStorage` and persisted across sessions. No server-side locale logic is required — all i18n is handled entirely on the frontend.

| Language | Locale code | Notes |
|---|---|---|
| English | `en` | Default |
| Traditional Chinese | `zh-TW` | Used in Hong Kong, Taiwan, Macau |
| Simplified Chinese | `zh-CN` | Used in mainland China |

### 5.2 Implementation approach

Use **react-i18next** (built on i18next) as the localization library. It is the most widely adopted React i18n solution, has excellent TypeScript support, and handles pluralisation, interpolation, and namespace splitting cleanly.

**Library choices:**

| Package | Role |
|---|---|
| `i18next` | Core i18n engine |
| `react-i18next` | React bindings (`useTranslation` hook, `Trans` component) |
| `i18next-browser-languagedetector` | Auto-detects browser locale on first visit |

### 5.3 File structure

Translation files live in the frontend package under `public/locales/`:

```
packages/frontend/
  public/
    locales/
      en/
        common.json       ← shared UI strings (buttons, labels, errors)
        game.json         ← game-specific strings (voting phase, reveal, stats)
      zh-TW/
        common.json
        game.json
      zh-CN/
        common.json
        game.json
```

Splitting into namespaces (`common`, `game`) keeps files small and allows lazy-loading — the `game` namespace only loads once a user enters a room.

### 5.4 Language selection UX

- On first visit, `i18next-browser-languagedetector` reads the browser's `navigator.language` and selects the closest supported locale, falling back to `en` if no match.
- A language switcher (globe icon dropdown) is visible in the top-right corner of every page. Options: English, 繁體中文, 简体中文.
- The selected locale is written to `localStorage` under the key `i18nextLng` and automatically restored on next visit.
- Language changes take effect immediately without a page reload (react-i18next handles this reactively).

### 5.5 Locale string example

```json
// en/game.json
{
  "waitingForVotes": "Waiting for votes ({{count}}/{{total}})",
  "revealButton": "Reveal cards",
  "resetButton": "New round",
  "stats": {
    "average": "Average",
    "median": "Median",
    "min": "Min",
    "max": "Max"
  }
}

// zh-TW/game.json
{
  "waitingForVotes": "等待投票中 ({{count}}/{{total}})",
  "revealButton": "翻開卡牌",
  "resetButton": "新一輪",
  "stats": {
    "average": "平均",
    "median": "中位數",
    "min": "最低",
    "max": "最高"
  }
}

// zh-CN/game.json
{
  "waitingForVotes": "等待投票中 ({{count}}/{{total}})",
  "revealButton": "翻开卡牌",
  "resetButton": "新一轮",
  "stats": {
    "average": "平均",
    "median": "中位数",
    "min": "最低",
    "max": "最高"
  }
}
```

### 5.6 Shared types

Add a `Locale` type to the shared package so it can be referenced in any future server-side locale handling:

```ts
// packages/shared/src/types.ts
export type Locale = 'en' | 'zh-TW' | 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh-TW', 'zh-CN'];
export const DEFAULT_LOCALE: Locale = 'en';
```

### 5.7 Key considerations

- **No server-side i18n needed for v1.** Room codes, event names, and error codes are language-agnostic identifiers. Only human-readable error messages displayed in the UI need translation.
- **Font coverage.** Ensure the chosen UI font stack includes a CJK fallback: `font-family: "Inter", "Noto Sans TC", "Noto Sans SC", sans-serif`. This prevents rendering issues on systems without bundled CJK fonts.
- **Text expansion.** Chinese strings are generally shorter than English for the same meaning — layout should not hard-code English string widths. Use flexible containers.
- **Adding languages later.** The namespace structure makes adding a fourth language (e.g. Japanese) a purely additive change: create a new locale folder and add the locale code to `SUPPORTED_LOCALES`. No component changes required.

---

## 6. Technical Architecture

### 6.1 Tech stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Shared types with backend, existing team expertise |
| State management | Zustand | Lightweight, no boilerplate, easy socket integration |
| Localization | react-i18next | Industry standard, TypeScript support, lazy namespace loading |
| Real-time transport | Socket.io client | Handles reconnection, fallback transports |
| Backend | Node.js + TypeScript | Shared type definitions, familiar ecosystem |
| WebSocket server | Socket.io (server) | Room namespacing, broadcast, presence built-in |
| HTTP layer | Express | Minimal REST endpoints (room creation, health check) |
| Room state | In-memory Map | No database required for v1 — ephemeral by design |
| Infra | Railway | Always-on server, no cold starts, $5/month hobby plan |
| Build tool | Vite (frontend) | Fast HMR, TypeScript out of the box |

### 6.2 Monorepo structure

```
scrum-poker/
  packages/
    shared/     — TypeScript types (Room, Vote, Player, SocketEvents, Locale)
    frontend/   — React + Vite app
                  public/locales/en/, zh-TW/, zh-CN/
    backend/    — Node.js + Express + Socket.io server
```

### 6.3 Socket.io event contract

**Client → Server:**

| Event | Payload |
|---|---|
| `join_room` | `{ roomCode, displayName }` — join and receive current room state snapshot |
| `cast_vote` | `{ value }` — submit a card selection |
| `reveal_votes` | *(facilitator only)* — trigger simultaneous reveal for all clients |
| `reset_round` | *(facilitator only)* — clear all votes, return to voting phase |
| `kick_participant` | *(facilitator only)* `{ participantId }` |

**Server → Client:**

| Event | Payload |
|---|---|
| `room_state` | Full snapshot of room (sent on join/reconnect) |
| `participant_joined` | `{ participantId, displayName }` |
| `participant_left` | `{ participantId }` |
| `vote_cast` | `{ participantId, hasVoted: true }` — never reveals value before reveal |
| `votes_revealed` | `{ votes: Record<participantId, value>, stats: { avg, median, min, max } }` |
| `round_reset` | — signals all clients to clear their local vote state |
| `error` | `{ message }` — e.g. room not found, not authorised |

---

## 7. Technical Challenges

| Challenge | Risk | Mitigation |
|---|---|---|
| Vote secrecy | Determined users could inspect WebSocket frames to see other votes before reveal | Never emit vote values in any server→client event until `votes_revealed` fires. Server stores values internally; broadcasts only `hasVoted: true` during voting phase. |
| Reconnection recovery | Page refresh or dropped connection loses room context | On `join_room`, server always responds with full `room_state` snapshot regardless of whether this is a first join or a rejoin. Store room state in the Map, never in the socket instance. |
| Facilitator authority | Any client could emit reveal or reset events | Server checks `socket.id === room.facilitatorId` before processing privileged events. Return `error` event if check fails. |
| Reveal race condition | A vote arriving simultaneously with a reveal event could cause inconsistency | Node.js single-threaded event loop serialises all events naturally on one process. No explicit locking needed for single-node deployment. |
| Horizontal scaling | Multiple Railway instances cannot share in-memory room state | For v1: deploy as a single instance (sufficient for expected load). If scaling is needed: add Socket.io Redis adapter for broadcast + sticky sessions for state routing. |
| Room expiry | Inactive rooms accumulate in memory indefinitely | Set a TTL per room (e.g. 2 hours of inactivity). Run a `setInterval` cleanup loop on the server to delete expired rooms. |

---

## 8. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Latency | Vote events and reveals should propagate to all clients within 200ms under normal network conditions. |
| Concurrency | Single Railway instance should comfortably support 50+ simultaneous rooms with 10 participants each (500 concurrent WebSocket connections) — well within Node.js defaults. |
| Availability | Railway hobby plan provides always-on deployment. No cold starts. Server restarts (deploys) will drop active rooms — acceptable for v1. |
| Browser support | Latest two versions of Chrome, Firefox, Safari, Edge. No IE11. |
| Mobile | Responsive layout required — many participants join on phones. Touch-friendly card selection. |
| Security | No sensitive data stored. Room codes are short-lived and ephemeral. No auth tokens for v1 (display name only). HTTPS enforced by Railway. |
| Accessibility | Card deck must be keyboard-navigable. Sufficient colour contrast for revealed vote values. |
| Localization | UI fully translated for `en`, `zh-TW`, `zh-CN`. CJK font fallback in font stack. Language auto-detected from browser, persisted in localStorage. |

---

## 9. Infrastructure & Deployment

### 9.1 Railway setup

- One Railway project with a single Node.js service
- No database service required for v1
- Environment variables: `NODE_ENV`, `PORT`, `CORS_ORIGIN`
- Health check endpoint: `GET /health` — returns `200 OK`
- Deploy on push to `main` branch via GitHub integration

### 9.2 Frontend hosting

- Build with Vite → static assets
- Options: Railway static site (same project), Vercel, or Cloudflare Pages
- Set `VITE_SOCKET_URL` env var to point at the Railway backend URL

### 9.3 Estimated cost

| Item | Cost |
|---|---|
| Railway hobby plan | $5/month — Node.js backend, always-on, no cold starts |
| Frontend hosting | $0 — Vercel or Cloudflare Pages free tier |
| **Total** | **~$5/month** |

---

## 10. Milestones

| Milestone | Scope |
|---|---|
| **1 — Scaffold** | Monorepo setup, shared types package, Express + Socket.io server, React + Vite app, Railway deploy pipeline, i18next wired up with all three locale files. |
| **2 — Room lifecycle** | Create room, join by code, participant list with real-time join/leave events, reconnection recovery. |
| **3 — Voting core** *(MVP)* | Card deck display, private vote casting, facilitator reveal, simultaneous card flip, vote statistics. |
| **4 — Polish** | Round reset, kick participant, mobile responsive layout, deck selection, room expiry cleanup, language switcher UI. |
| **5 — P1 features** | Observer mode, story name field, facilitator transfer, countdown timer. |

> Each milestone produces a deployable, testable increment. **Milestone 3 is the minimum viable product.**
