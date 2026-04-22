# In My Own Words

A reading prototype where you highlight a passage, write what it means in your own words, and a Facilitator AI pushes you to synthesise. Three Buddy personas offer parallel expert readings. Built for the Anthropic Education Labs Design Engineer take-home.

Core mechanic: **paraphrase-to-commit.** North Star: mastery and agency.

---

## Stack

- **Frontend** — Vite + React 19 + TypeScript + Tailwind v4
- **Backend** — Express + TypeScript (ESM)
- **AI** — `@anthropic-ai/sdk` — Claude Sonnet for Facilitator / Buddies, Claude Haiku for the commit-readiness classifier
- **Storage** — single JSON file on disk (`server/data/highlights.json`)
- **Monorepo** — npm workspaces, `concurrently` for dev, Prettier + Tailwind class sorting at the root
- **Headless primitives** — `@base-ui-components/react`
- **Icons** — `lucide-react`
- **Shared types** — `shared/types.ts`, imported by both workspaces via `@shared/*` alias

---

## Environment

- Copy `.env.example` to `.env`
- Set `ANTHROPIC_API_KEY`
- Without a key, AI endpoints return 501 with a friendly message — the UI still renders

---

## Quick start

```bash
npm install
cp .env.example .env        # add your ANTHROPIC_API_KEY
npm run dev
```

- Client — http://localhost:5173 (Vite, HMR)
- Server — http://localhost:3001 (Express, restarts via `tsx watch`)
- Vite proxies `/api/*` to the server, so frontend calls are same-origin

---

## Scripts

- `npm run dev` — client + server concurrently
- `npm run build` — Vite client build + tsc server compile
- `npm start` — run the built server (serves the built client + API)
- `npm run typecheck` — typecheck both workspaces
- `npm run format` — Prettier write
- `npm run format:check` — Prettier CI-style check

---

## Production

```bash
npm run build
NODE_ENV=production npm start
```

- Single Node process on a single port (default 3001)
- Express serves the static client from `client/dist/` + the API
- Runs anywhere that runs Node — behind nginx or similar

---

## Layout

```
in-my-own-words/
├── client/                    Vite + React + TS
│   ├── src/
│   │   ├── components/
│   │   │   ├── deck/          Slide-deck wrapper
│   │   │   ├── slides/        Individual deck slides
│   │   │   ├── prototype/     The interactive prototype pieces
│   │   │   └── ui/            Button, Avatar (from starter)
│   │   ├── lib/               cn() helper, highlights helpers, persistence
│   │   └── styles/globals.css Design tokens (from starter)
│   └── public/
│       ├── sessions.json      Session manifest
│       └── sessions/          Source texts (.txt)
├── server/
│   ├── src/
│   │   ├── routes/            One file per endpoint
│   │   └── lib/               anthropic client, storage, buddy personas
│   └── data/                  JSON storage (gitignored)
├── shared/types.ts            Cross-boundary types
└── BUILD_PLANS/               How this was built, plan-by-plan (for reviewers)
```

---

## API

All JSON in / JSON out. Types in `shared/types.ts`. No streaming.

- `GET  /api/health` — `{ ok, hasApiKey }`
- `POST /api/facilitator` — chat + synthesis modes; multi-turn
- `POST /api/commit-check` — Haiku classifier, returns `{ commitReady, reason }`
- `POST /api/consult` — parallel buddy calls, returns array of responses
- `GET  /api/buddies` — buddy roster
- `POST /api/verify` — re-check a specific buddy response
- `GET  /api/highlights` — read the JSON file
- `POST /api/highlights` — replace the JSON file

---

## Scope notes

Everything below is deliberate, documented in the deck:

- No streaming — loading indicators do the work
- No auth, no multi-user, no real database
- 3 hardcoded buddies (English Teacher, Historian, Reframer) in `server/src/lib/buddies.ts`
- Add a buddy by appending to the `BUDDIES` array — no other code changes
- "Build your own buddy" UI is a v2 idea
- No buddy-to-buddy chat

---

## Build history

- `BUILD_PLANS/` — atomic plans used to build this, one session per plan
- `BUILD_PLANS/STATE.md` — current progress marker
- `BUILD_PLANS/TEST_LIST.md` — human-judgment tests to run before shipping
- `BUILD_PLANS/feature-*` — post-MVP polish, not part of the main build

---

## Credits

Design tokens, `cn()` utility, primitive component patterns, and visual assets adapted from the Anthropic Education Labs takehome starter.
</content>
