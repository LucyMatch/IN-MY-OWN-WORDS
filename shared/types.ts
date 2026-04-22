/**
 * Shared types — used by both client and server.
 *
 * Anything that crosses the network boundary (request bodies, response
 * shapes, the persisted Highlight shape) lives here so we keep one source
 * of truth. Pure types only — no runtime code, no imports beyond TypeScript
 * built-ins.
 *
 * Imported by:
 *   - server: from '../../shared/types.js' (note .js for ESM resolution at runtime)
 *   - client: from '@shared/types' (path alias, see vite.config.ts and tsconfig.json)
 *
 * If a type is only used inside one workspace (e.g. internal storage helpers,
 * UI-only state), keep it local. This file is for the contract between the
 * two sides.
 */

/* ============================================================
   Buddies
   ============================================================ */

/** Buddy roster entry — what the client renders to identify each buddy. */
export type BuddyMeta = {
  id: string
  name: string
  description: string
}

/** A single buddy's response to a passage. Multiple responses from the same buddy have different ids. */
export type BuddyResponse = {
  /** Unique id for this individual response (not the buddy). */
  id: string
  buddyId: string
  buddyName?: string
  text?: string
  error?: string
  /** Verification text appended below the response when the user clicks Verify. */
  verification?: string
  /** Transient — true while a verify call is in flight. */
  verifying?: boolean
  createdAt: string
}

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

/* ============================================================
   Highlights — the persisted unit
   ============================================================ */

/**
 * One visual range of a highlight. A highlight that spans paragraphs has
 * multiple ranges, one per paragraph it touches. Offsets are relative to
 * the paragraph's text content (after paragraph splitting in ReadingPane).
 * paragraphIndex is an index into the full blocks array (index 0 = heading).
 */
export type HighlightRange = {
  paragraphIndex: number
  start: number
  end: number
}

/**
 * A single paraphrase-in-your-own-words for a highlight. Users can stage
 * multiple bubbles per highlight, edit, and delete them before committing.
 * The committed flag is wired in plan-04; this plan leaves it false.
 */
export type Bubble = {
  id: string
  text: string
  staged: boolean
  committed: boolean
  createdAt: string
}

export type Highlight = {
  id: string
  sessionId: string
  /**
   * Visual ranges. Length 1 for single-paragraph selections, N for multi.
   * Order reflects reading order (first range is topmost on the page).
   */
  ranges: HighlightRange[]
  /**
   * The full selected text, concatenated across ranges with \n\n between
   * paragraph boundaries. This is what we send to Facilitator/Buddies.
   */
  text: string
  bubbles: Bubble[]
  /** Buddy responses (parallel call results). May be empty if not consulted. */
  buddyResponses: BuddyResponse[]
  /**
   * Chat thread for this highlight. Added in plan-08.
   * Persists with the highlight — each highlight owns its conversation.
   */
  chatHistory: ChatMessage[]
  /**
   * Transient. Stripped before save (plan-06). Defaults to false on load.
   * Re-populated by the classifier on the next synthesis turn.
   */
  commitReady: boolean
  /** ISO timestamp. */
  createdAt: string
}

/* ============================================================
   Facilitator chat
   ============================================================ */

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Distinguishes chat vs synthesis responses for rendering. Defaults to 'chat'. */
  kind?: 'chat' | 'synthesis'
}

/* ============================================================
   API request/response shapes
   ============================================================ */

// /api/health
export type HealthResponse = {
  ok: true
  hasApiKey: boolean
}

// POST /api/consult
export type ConsultRequest = {
  highlight: string
  bubbles: string[]
}
export type ConsultResponse = {
  responses: BuddyResponse[]
}

// GET /api/buddies
export type BuddiesResponse = {
  buddies: BuddyMeta[]
}

// POST /api/facilitator
export type FacilitatorRequest = {
  messages: ChatMessage[]
  /** The highlighted passage, if any. */
  highlight?: string
  /** Session metadata — ALWAYS passed, both modes use it. */
  session?: {
    title: string
    author: string
    section: string
  }
  /** If provided, this is a synthesis call — Facilitator pivots to synthesis-mode prompt. */
  synthesisContext?: {
    bubbles: Array<{
      text: string
      /** True if this is the bubble the user just staged or just edited. */
      isFocus: boolean
    }>
  }
}
export type FacilitatorResponse = {
  text: string
}

// POST /api/commit-check
export type CommitCheckRequest = {
  highlight: string
  bubbles: string[]
  facilitatorResponse: string
}
export type CommitCheckResponse = {
  commitReady: boolean
  reason: string
}

// POST /api/verify
export type VerifyRequest = {
  highlight: string
  originalResponse: string
  buddyId?: string
}
export type VerifyResponse = {
  text: string
}

// /api/highlights
export type HighlightsGetResponse = Highlight[]
export type HighlightsPostRequest = Highlight[]
export type HighlightsPostResponse = {
  ok: true
  count: number
}

// Generic error response shape returned by any endpoint on failure.
export type ApiErrorResponse = {
  error: string
}
