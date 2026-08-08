# SetterSaga

A real-time multiplayer settlement-building board game for 3–8 players. Roll dice, collect resources, trade, build roads and cities, and race to the victory-point target — in the browser or as a desktop app.

Built as a Turborepo monorepo: a Next.js client, a Convex backend for persistence and live sync, and a framework-free rules engine that both sides share.

## Features

- **3–8 player online games** with `base`, `extended-6`, and `extended-8` maps
- **Rooms and quick match** — create a private room with a share code, or drop into a quick game
- **Bots** at easy / medium / hard difficulty, including replacing a player who leaves
- **Configurable rules** — victory-point target, turn timer, discard limit, balanced dice, friendly robber, hidden bank cards
- **Reconnect-safe sessions** — game state lives on the server; refreshing or rejoining restores the seat
- **Deterministic engine** — seeded randomness and pure reducers keep rules identical across clients and server
- **Desktop build** via Electrobun, wrapping the same web client

## Tech stack

| Layer        | Choice                                                           |
| ------------ | ---------------------------------------------------------------- |
| Client       | Next.js 16, React 19, Tailwind CSS v4, HeroUI                    |
| Backend      | Convex (database, queries/mutations, scheduling, real-time sync) |
| Auth         | Hexclave                                                         |
| Rules engine | Plain TypeScript, no framework dependencies                      |
| Desktop      | Electrobun                                                       |
| Tooling      | Turborepo, pnpm, Oxlint, Oxfmt, Bun test                         |

Only Next.js and Convex are used for the client and backend respectively. Adding another framework, database, or API layer is an explicit architecture decision, not a drive-by change.

## Repository layout

```
apps/
  web/          Next.js client — game board, lobby, rooms, quick match
  desktop/      Electrobun shell around the web client
packages/
  game/         Deterministic rules engine: board, topology, rules, bots,
                longest road, largest army, validation, view projection
  backend/      Convex functions and schema: rooms, games, automation, auth
  env/          Type-safe environment variable parsing (@t3-oss/env-core + zod)
  config/       Shared TypeScript config
```

`packages/game` is the source of truth for rules. `packages/backend` applies commands through it and stores the resulting state; the client renders projected views and never computes authoritative state itself.

## Getting started

Requires [Bun](https://bun.sh) (for tests), pnpm 11, and Node 22+.

```bash
pnpm install
```

Copy the environment template and fill it in:

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable                                      | Purpose               |
| --------------------------------------------- | --------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                      | Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL`                 | Convex site URL       |
| `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID`             | Hexclave project ID   |
| `NEXT_PUBLIC_HEXCLAVE_PUBLISHABLE_CLIENT_KEY` | Hexclave client key   |
| `NEXT_PUBLIC_HEXCLAVE_SECRET_SERVER_KEY`      | Hexclave server key   |

Configure and start the Convex development deployment (writes `NEXT_PUBLIC_CONVEX_URL` for you on first run):

```bash
pnpm dev:setup
```

Then run everything:

```bash
pnpm dev
```

The web client is served at http://localhost:3000.

## Scripts

| Command                     | Description                                   |
| --------------------------- | --------------------------------------------- |
| `pnpm dev`                  | Run all dev tasks through Turborepo           |
| `pnpm dev:web`              | Web client only                               |
| `pnpm dev:server`           | Convex dev deployment only                    |
| `pnpm dev:setup`            | Configure and start the Convex dev deployment |
| `pnpm dev:desktop`          | Desktop app with HMR against the web client   |
| `pnpm build`                | Build all workspaces (desktop last)           |
| `pnpm build:desktop`        | Desktop stable build                          |
| `pnpm build:desktop:canary` | Desktop canary build                          |
| `pnpm test`                 | Bun tests for `game`, `backend`, and `web`    |
| `pnpm check-types`          | Type-check every workspace, including tests   |
| `pnpm check`                | Oxlint, then format with Oxfmt                |

## Testing

```bash
pnpm test
```

Tests cover board generation, rule application, longest-road computation, state validation, command boundaries, seat reconciliation, and game scheduling. Type-level tests (`*.test-d.ts`) run through `pnpm check-types`.

## Conventions

- Keep game state separate from presentation; the engine has no React or Convex imports.
- Rules must stay deterministic — route all randomness through the seeded helpers in `packages/game/src/random.ts`.
- Components take colors from the global CSS theme. Don't hardcode color classes on components.
- Run `pnpm check` and `pnpm check-types` before committing.
