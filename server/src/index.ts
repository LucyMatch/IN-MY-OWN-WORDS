/**
 * Express server entrypoint.
 *
 * - Loads .env from the repo root (NOT from /server)
 * - Wires JSON + CORS middleware
 * - Mounts the API routes under /api/*
 * - In production, also serves the built Vite client from ../client/dist
 *
 * Dev: `npm run dev` from the repo root (uses concurrently).
 * Prod: `npm run build && npm start` from the repo root.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { findWorkspaceRoot } from './lib/paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from the repo root (one level above the server workspace).
// findWorkspaceRoot walks up to server/ regardless of whether we're running
// from server/src (dev/tsx) or server/dist/server/src (prod/tsc).
const serverRoot = findWorkspaceRoot(__dirname)
dotenv.config({ path: path.resolve(serverRoot, '../.env') })

// All other imports go AFTER dotenv is configured so they see the env vars.
import express from 'express'
import cors from 'cors'

import { healthRoute } from './routes/health.js'
import { lensRoute } from './routes/lens.js'
import { personasRoute } from './routes/personas.js'
import { commitCheckRoute } from './routes/commitCheck.js'
import { facilitatorRoute } from './routes/facilitator.js'
import { verifyRoute } from './routes/verify.js'
import { highlightsRoute } from './routes/highlights.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(express.json({ limit: '5mb' }))

// CORS is harmless in dev (Vite proxy makes requests same-origin anyway)
// and harmless in prod (Express serves the client itself, also same-origin).
// Left wide-open here as a safety net for anyone hitting the API directly.
app.use(cors())

// API routes — order doesn't matter, all under /api.
app.use('/api', healthRoute)
app.use('/api', lensRoute)
app.use('/api', personasRoute)
app.use('/api', commitCheckRoute)
app.use('/api', facilitatorRoute)
app.use('/api', verifyRoute)
app.use('/api', highlightsRoute)

// In production, serve the built client from ../client/dist as a static SPA.
// In dev, Vite serves the client on its own port (5173) and proxies /api here.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(serverRoot, '../client/dist')
  app.use(express.static(clientDist))
  // SPA fallback: any non-/api GET returns index.html so client-side routing works.
  // Using a regex (not '*') to avoid path-to-regexp quirks across Express versions.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[server] no ANTHROPIC_API_KEY set — AI endpoints will return 501')
  } else {
    console.log('[server] ANTHROPIC_API_KEY detected — AI endpoints active')
  }
})
