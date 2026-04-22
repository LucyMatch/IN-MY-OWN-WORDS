# Plan 00 — Prep

Read `BUILD_PLANS/context.md` and `BUILD_PLANS/STATE.md` first.

Short housekeeping session. No new components. The job is to get the repo into a clean state so plan-01 (and everything after) starts on solid ground.

---

## What this does

Three things:

1. Rename a stale field on the `Highlight` type (`documentId` → `sessionId`)
2. Add a new `Session` type to `shared/types.ts`
3. Regenerate `package-lock.json`

That's it. Nothing else should change.

---

## Tasks

### 1. Rename `Highlight.documentId` → `Highlight.sessionId`

In `shared/types.ts`, find:

```ts
export type Highlight = {
  id: string
  documentId: string
  text: string
  articulation: string | null
  buddyResponses: BuddyResponse[]
  createdAt: string
}
```

Rename `documentId` to `sessionId`. No other files consume this field yet, so no further updates required. Verify by searching the whole repo for the string `documentId` — should have zero matches after the rename.

### 2. Add the `Session` type

In the same file (`shared/types.ts`), add a new exported type. Good placement: near the top, before `Highlights` — or as its own section above "Highlights".

```ts
/* ============================================================
   Sessions
   ============================================================ */

/**
 * A reading session. Each session is a single .txt file served from
 * /public/sessions/ with metadata manifested in /public/sessions.json.
 */
export type Session = {
  id: string
  title: string
  author: string
  /** Where the extracted text sits inside the source work (e.g. "Chapter 8", "Act 3, Scene 1"). */
  section: string
  /** Filename inside /public/sessions/. */
  filename: string
}
```

### 3. Regenerate `package-lock.json`

The lock file still has entries for `unpdf`, `multer`, and `@types/multer` that are no longer in any `package.json`. Regenerate:

```bash
npm install
```

from the repo root. This reconciles the lock file with the workspaces' `package.json` files and removes the stale entries. No new dependencies are being added — `npm install` here is purely a lock-file refresh.

Verify by searching the new `package-lock.json` for `unpdf`, `multer`, `@types/multer` — all three should return zero matches.

---

## Constraints

- **Do not add, rename, or delete any files** beyond the `package-lock.json` regeneration handled by `npm install`.
- **Do not touch any source file** other than `shared/types.ts`.
- Do not start the dev server.

---

## Definition of done

- `shared/types.ts` has `sessionId` on `Highlight` (no `documentId` anywhere in the repo) and exports the new `Session` type
- `package-lock.json` has no `unpdf`, `multer`, or `@types/multer` entries
- `npm run typecheck` passes for both workspaces
- Update `BUILD_PLANS/STATE.md` — tick plan-00 as done, mark plan-01 as next
