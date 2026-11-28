# Scrum Poker

Real-time, browser-based planning poker. See [scrum-poker-prd.md](./scrum-poker-prd.md) for the full product spec, [docs/implementation-plan.md](./docs/implementation-plan.md) for the milestone history, and [docs/phase-2-plan.md](./docs/phase-2-plan.md) for the plan for what's next (tests/CI, deployment, reconnect identity, abuse limits).

## Structure

```
packages/
  shared/     — shared TypeScript types and Socket.io event contracts
  backend/    — Express + Socket.io server
  frontend/   — React + Vite app
```

## Development

```bash
npm install
npm run dev        # runs backend (:4000) and frontend (:5173) concurrently
```

Copy `.env.example` to `.env` in `packages/backend` and `packages/frontend` to customize ports/URLs.

## Build

```bash
npm run build       # builds shared, backend, frontend in order
npm run typecheck   # typechecks all packages
```

## Testing

```bash
npm test            # all tests once (Vitest)
npm run test:watch  # re-run on change
```

- `packages/shared`: deck and card validation.
- `packages/backend`: unit tests for the room rules, stats and expiry, plus integration tests that start the real Express + Socket.io server on a random port and drive it with `socket.io-client` (see `src/testing/harness.ts`).
- `packages/frontend`: pure logic (outlier rule, deck choice helpers) and the Zustand store, driven through a fake socket.

Tests run against `shared`'s source, so no build is needed first. CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, `npm run typecheck` and `npm test` on every pull request and on pushes to `main`.

## Deployment

The backend deploys to Railway (see `railway.json`). The frontend builds to static assets deployable to Vercel, Cloudflare Pages, or Railway static hosting — set `VITE_SOCKET_URL` to the backend's public URL. The host must serve `index.html` for unknown paths (SPA fallback) so `/room/:code` links work.
