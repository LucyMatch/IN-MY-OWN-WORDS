import { Router } from 'express'
import { getPersonaRoster } from '../lib/personas.js'
import type { PersonasResponse } from '@shared/types'

export const personasRoute = Router()

personasRoute.get('/personas', (_req, res) => {
  const body: PersonasResponse = { personas: getPersonaRoster() }
  res.json(body)
})
