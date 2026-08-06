# Repository Guidelines

## Product & Technology Scope

SetterSaga is a Setter.io-style multiplayer board game. Build deterministic rules, real-time turns, reconnect-safe sessions, and separate game state from presentation. Use only Next.js for the client and Convex for the backend, persistence, and synchronization. Do not add another framework, database, or API layer without an explicit architecture change.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies.
- `pnpm dev:setup`: configure and start the Convex development deployment.
- `pnpm dev`: run all development tasks through Turborepo.
- `pnpm dev:web`: run the web client only.
- `pnpm build`: build all configured workspace packages.
- `pnpm check-types`: type-check configured packages.
- `pnpm check`: run Oxlint, then format with Oxfmt.

## Must

Dont use Custum class in components for colors, always Follow COlor from global css
