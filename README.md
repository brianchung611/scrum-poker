# Scrum Poker

Real-time, browser-based planning poker. See [scrum-poker-prd.md](./scrum-poker-prd.md) for the full product spec, and [docs/implementation-plan.md](./docs/implementation-plan.md) for milestone progress and the plan for what's next.

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

## Deployment

The backend deploys to Railway (see `railway.json`). The frontend builds to static assets deployable to Vercel, Cloudflare Pages, or Railway static hosting — set `VITE_SOCKET_URL` to the backend's public URL.
