/**
 * Health check.
 * GET /api/health → { ok: true, hasApiKey: boolean }
 *
 * Used by the client landing page to confirm the proxy is wired up.
 */

import { Router } from 'express'
import type { HealthResponse } from '@shared/types'

export const healthRoute = Router()

healthRoute.get('/health', (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
  }
  res.json(body)
})
