# SetterSaga

A real-time multiplayer settlement-building board game for 3–8 players. Roll dice, collect resources, trade, build roads and cities, and race to the victory-point target — in the browser or in a desktop shell.

Built as a Turborepo monorepo: a Next.js client, a Convex backend for persistence and live sync, and a framework-free rules engine that both sides share.

## Features

- **3–8 player online games** on the `base` (3–4 players), `extended-6` (5–6), and `extended-8` (7–8) maps
- **Private rooms and quick match** — invite friends with a room code, or start a solo game against bots right away
- **Bots** at easy / medium / hard difficulty; the host can hand any seat to a bot, and a bot takes over when a player leaves mid-game
- **Configurable rules** — victory-point target, turn timer, discard limit, balanced dice, friendly robber, hidden bank cards
- **Host controls** — pause and resume a running game
- **Google sign-in or guest play**
- **Reconnect-safe sessions** — game state lives on the server; refreshing or rejoining restores the seat
- **Deterministic engine** — seeded randomness and pure reducers keep rules identical across clients and server
- **Desktop shell** via Electrobun that loads the web app

## Tech stack

| Layer        | Choice                                                           |
| ------------ | ---------------------------------------------------------------- |
| Client       | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui on Base UI      |
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
  desktop/      Electrobun shell that opens the web app in a native window
packages/
  game/         Deterministic rules engine: board, topology, rules, bots,
                longest road, largest army, validation, view projection
  backend/      Convex functions and schema: rooms, games, automation, auth
  config/       Shared TypeScript config
```

`packages/game` is the source of truth for rules. `packages/backend` applies commands through it and stores the resulting state; the client renders projected views and never decides game outcomes itself.

## Getting started

Requires [Bun](https://bun.sh) (for tests), pnpm 11, and Node 22+.

```bash
pnpm install
```

Configure the Convex development deployment. On first run this writes `CONVEX_DEPLOYMENT` and `CONVEX_URL` to `packages/backend/.env.local`:

```bash
pnpm dev:setup
```

Point Convex at your Hexclave project so it accepts Hexclave sign-ins:

```bash
pnpm -F @settersaga/backend exec convex env set HEXCLAVE_PROJECT_ID <your-hexclave-project-id>
```

Copy the web environment template and fill it in:

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable                                      | Purpose                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                      | Convex deployment URL (the `CONVEX_URL` written by setup)      |
| `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID`             | Hexclave project ID                                            |
| `NEXT_PUBLIC_HEXCLAVE_PUBLISHABLE_CLIENT_KEY` | Hexclave publishable client key                                |
| `HEXCLAVE_SECRET_SERVER_KEY`                  | Hexclave secret server key — server only, never `NEXT_PUBLIC_` |

Then run everything:

```bash
pnpm dev
```

The web client is served at http://localhost:3000.

## Desktop app

The web app needs its Next.js server, so the Electrobun shell loads it by URL rather than bundling it. The URL is read from `SETTERSAGA_WEB_URL` when the shell is built. Dev builds default to `http://localhost:3000`.

- `pnpm dev:desktop` runs everything `pnpm dev` runs, plus the shell. Use it instead of `pnpm dev`, not alongside it, since both start the web server on port 3000. The shell opens its window once the web server responds.
- `pnpm build:desktop` and `pnpm build:desktop:canary` need `SETTERSAGA_WEB_URL` set to the deployed web app, and the build fails without it.

## Scripts

| Command                     | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `pnpm dev`                  | Run all dev tasks through Turborepo              |
| `pnpm dev:web`              | Web client only                                  |
| `pnpm dev:server`           | Convex dev deployment only                       |
| `pnpm dev:setup`            | Configure the Convex dev deployment              |
| `pnpm dev:desktop`          | Everything in `pnpm dev`, plus the desktop shell |
| `pnpm build`                | Build all workspaces                             |
| `pnpm build:desktop`        | Desktop stable build                             |
| `pnpm build:desktop:canary` | Desktop canary build                             |
| `pnpm test`                 | Bun tests for `game`, `backend`, and `web`       |
| `pnpm check-types`          | Type-check every workspace, including test files |
| `pnpm check`                | Oxlint, then format with Oxfmt                   |

## Testing

```bash
pnpm test
```

Bun runs the suites in `packages/game/tests`, `packages/backend/tests`, and `apps/web/tests`:

- **Engine** — board generation, rule application, longest road, state validation, bot names
- **Backend** — command events, game settings, stored game state, seat reconciliation, game scheduling
- **Web** — event log, audio cues and settings, background music, board layout, lobby settings, player HUD order, resource card changes

`pnpm check-types` also type-checks these test files through `tsconfig.tests.json`.

## Conventions

- Keep game state separate from presentation; the engine has no React or Convex imports.
- Rules must stay deterministic — route all randomness through the seeded helpers in `packages/game/src/random.ts`.
- Components take colors from the global CSS theme. Don't hardcode color classes on components.
- Run `pnpm check` and `pnpm check-types` before committing.
