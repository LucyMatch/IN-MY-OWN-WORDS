import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Bubble,
  ChatMessage,
  CommitCheckRequest,
  CommitCheckResponse,
  FacilitatorRequest,
  FacilitatorResponse,
  Highlight,
  LensRequest,
  LensResponse,
  Persona,
  PersonasResponse,
  Session,
} from '@shared/types'
import { loadHighlights, saveHighlights } from '@/lib/persistence'
import { SessionsPanel } from '@/components/prototype/SessionsPanel'
import { ReadingPane } from '@/components/prototype/ReadingPane'
import { InYourOwnWordsPane } from '@/components/prototype/InYourOwnWordsPane'
import { FacilitatorChat } from '@/components/prototype/FacilitatorChat'
import { LensPane } from '@/components/prototype/LensPane'

export function PrototypeSlide() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionText, setSessionText] = useState<string>('')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingText, setLoadingText] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [facilitatorLoading, setFacilitatorLoading] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [invokingPersonaId, setInvokingPersonaId] = useState<string | null>(null)
  const [lensPaneExpanded, setLensPaneExpanded] = useState(false)
  const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false)

  // hasHydratedRef: false until initial load completes.
  // skipNextSaveRef: set true just before setHighlights(loaded) so the save-effect
  // can detect the hydration render and return early without writing back.
  const hasHydratedRef = useRef(false)
  const skipNextSaveRef = useRef(false)

  useEffect(() => {
    fetch('/sessions.json')
      .then((r) => r.json())
      .then((data: Session[]) => {
        setSessions(data)
        if (data.length > 0) setActiveSessionId(data[0].id)
        setLoadingSessions(false)
      })
      .catch(() => {
        setError('Failed to load sessions')
        setLoadingSessions(false)
      })
  }, [])

  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return
    setLoadingText(true)
    fetch(`/sessions/${session.filename}`)
      .then((r) => r.text())
      .then((text) => {
        setSessionText(text)
        setLoadingText(false)
      })
      .catch(() => {
        setError(`Failed to load ${session.filename}`)
        setLoadingText(false)
      })
  }, [sessions, activeSessionId])

  useEffect(() => {
    void (async () => {
      const loaded = await loadHighlights()
      skipNextSaveRef.current = true
      setHighlights(loaded)
      hasHydratedRef.current = true
    })()
  }, [])

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    if (!hasHydratedRef.current) return
    saveHighlights(highlights)
  }, [highlights])

  useEffect(() => {
    // Highlights are NOT cleared on session switch — flat array, filtered at render time.
    // Only session-local UI state gets reset.
    setActiveHighlightId(null)
  }, [activeSessionId])

  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((data: PersonasResponse) => setPersonas(data.personas))
      .catch((err) => console.error('[personas] load error', err))
  }, [])

  useEffect(() => {
    if (activeHighlightId !== null) {
      setLensPaneExpanded(true)
      setIsSessionsCollapsed(true)
    }
  }, [activeHighlightId])

  function autoCollapseSessions() {
    setIsSessionsCollapsed(true)
  }

  function addHighlight(h: Highlight) {
    const withChat: Highlight = { ...h, chatHistory: h.chatHistory ?? [] }
    setHighlights((prev) => [...prev, withChat])
    setActiveHighlightId(withChat.id)
    autoCollapseSessions()
  }

  function deleteHighlight(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    setActiveHighlightId((prev) => (prev === id ? null : prev))
  }

  // sendSynthesisTurn receives the updated bubble list directly to avoid
  // reading stale state — setHighlights is async, so the new bubble won't
  // be in `highlights` yet when this fires.
  async function sendSynthesisTurn(
    highlightId: string,
    focusBubbleId: string,
    highlightText: string,
    currentBubbles: Bubble[],
  ) {
    const focusBubble = currentBubbles.find((b) => b.id === focusBubbleId)
    if (!focusBubble) return

    // Read the current chat for this specific highlight at call time.
    const highlight = highlights.find((h) => h.id === highlightId)
    const currentChat = highlight?.chatHistory ?? []

    const syntheticUserMessage: ChatMessage = {
      role: 'user',
      content: `[staged: '${focusBubble.text}']`,
      kind: 'synthesis',
    }

    const historyBeforeCall = [...currentChat, syntheticUserMessage]

    // Append the synthetic user message immediately (for UI feedback).
    // All writes target highlightId, not activeHighlightId — handles mid-call highlight switch.
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, syntheticUserMessage] }
          : h,
      ),
    )
    setFacilitatorLoading(true)

    try {
      const facilitatorBody: FacilitatorRequest = {
        messages: historyBeforeCall,
        highlight: highlightText,
        session: activeSession
          ? {
              title: activeSession.title,
              author: activeSession.author,
              section: activeSession.section,
            }
          : undefined,
        synthesisContext: {
          bubbles: currentBubbles.map((b) => ({
            text: b.text,
            isFocus: b.id === focusBubbleId,
          })),
        },
      }

      const facilitatorRes = await fetch('/api/facilitator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facilitatorBody),
      })

      if (!facilitatorRes.ok) {
        const errMsg =
          facilitatorRes.status === 501
            ? 'Facilitator unavailable — API key not configured.'
            : 'Facilitator call failed. Please try again.'
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId
              ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
              : h,
          ),
        )
        return
      }

      const facilitatorData = (await facilitatorRes.json()) as FacilitatorResponse
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: facilitatorData.text,
        kind: 'synthesis',
      }
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, assistantMessage] }
            : h,
        ),
      )

      // Second call: classifier
      const commitBody: CommitCheckRequest = {
        highlight: highlightText,
        bubbles: currentBubbles.map((b) => b.text),
        facilitatorResponse: facilitatorData.text,
      }

      const commitRes = await fetch('/api/commit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitBody),
      })

      if (commitRes.ok) {
        const commitData = (await commitRes.json()) as CommitCheckResponse
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId ? { ...h, commitReady: commitData.commitReady } : h,
          ),
        )
      }
    } catch {
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong. Please try again.', kind: 'chat' }] }
            : h,
        ),
      )
    } finally {
      setFacilitatorLoading(false)
    }
  }

  async function sendChatMessage(text: string) {
    if (!activeHighlightId) return
    const highlightId = activeHighlightId
    const targetHighlight = highlights.find((h) => h.id === highlightId)
    if (!targetHighlight) return

    const userMessage: ChatMessage = { role: 'user', content: text, kind: 'chat' }
    const historyBeforeCall = [...targetHighlight.chatHistory, userMessage]

    // All writes target highlightId, not activeHighlightId — handles mid-call highlight switch.
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, userMessage] }
          : h,
      ),
    )
    setFacilitatorLoading(true)

    try {
      const body: FacilitatorRequest = {
        messages: historyBeforeCall,
        highlight: targetHighlight.text,
        session: activeSession
          ? {
              title: activeSession.title,
              author: activeSession.author,
              section: activeSession.section,
            }
          : undefined,
      }

      const res = await fetch('/api/facilitator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errMsg =
          res.status === 501
            ? 'Facilitator unavailable — API key not configured.'
            : 'Facilitator call failed. Please try again.'
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId
              ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
              : h,
          ),
        )
        return
      }

      const data = (await res.json()) as FacilitatorResponse
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: data.text, kind: 'chat' }] }
            : h,
        ),
      )
    } catch {
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong. Please try again.', kind: 'chat' }] }
            : h,
        ),
      )
    } finally {
      setFacilitatorLoading(false)
    }
  }

  async function invokeLens(personaId: string) {
    if (!activeHighlightId) return
    const activeHighlight = highlights.find((h) => h.id === activeHighlightId)
    if (!activeHighlight) return

    const highlightId = activeHighlight.id  // capture for safe mid-call highlight switch
    const persona = personas.find((p) => p.id === personaId)
    if (!persona) return

    setInvokingPersonaId(personaId)

    try {
      const body: LensRequest = {
        personaId,
        highlight: activeHighlight.text,
        descriptions: activeHighlight.bubbles.map((b) => b.text),
        session: activeSession
          ? { title: activeSession.title, author: activeSession.author, section: activeSession.section }
          : undefined,
        chatHistory: activeHighlight.chatHistory,
      }

      const res = await fetch('/api/lens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errMsg =
          res.status === 501
            ? 'Lens unavailable — API key not configured.'
            : 'Lens call failed. Please try again.'
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId
              ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
              : h,
          ),
        )
        return
      }

      const data = (await res.json()) as LensResponse
      const lensMessage: ChatMessage = {
        role: 'assistant',
        content: data.text,
        kind: 'lens',
        personaId: data.personaId,
        personaName: data.personaName,
      }

      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, lensMessage] }
            : h,
        ),
      )
    } catch {
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong.', kind: 'chat' }] }
            : h,
        ),
      )
    } finally {
      setInvokingPersonaId(null)
    }
  }

  function addBubble(highlightId: string, text: string) {
    const newBubbleId = crypto.randomUUID()
    let updatedBubbles: Bubble[] = []
    let highlightText = ''

    setHighlights((prev) =>
      prev.map((h) => {
        if (h.id !== highlightId) return h
        updatedBubbles = [
          ...h.bubbles,
          {
            id: newBubbleId,
            text,
            staged: true,
            committed: false,
            createdAt: new Date().toISOString(),
          },
        ]
        highlightText = h.text
        return { ...h, bubbles: updatedBubbles, commitReady: false }
      }),
    )

    autoCollapseSessions()
    void sendSynthesisTurn(highlightId, newBubbleId, highlightText, updatedBubbles)
  }

  function updateBubble(highlightId: string, bubbleId: string, text: string) {
    const currentHighlight = highlights.find((h) => h.id === highlightId)
    if (!currentHighlight) return

    const updatedBubbles = currentHighlight.bubbles.map((b) =>
      b.id === bubbleId ? { ...b, text } : b,
    )

    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, bubbles: updatedBubbles, commitReady: false }
          : h,
      ),
    )

    autoCollapseSessions()
    void sendSynthesisTurn(highlightId, bubbleId, currentHighlight.text, updatedBubbles)
  }

  function deleteBubble(highlightId: string, bubbleId: string) {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, bubbles: h.bubbles.filter((b) => b.id !== bubbleId) }
          : h,
      ),
    )
  }

  function commitHighlight(highlightId: string) {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? {
              ...h,
              bubbles: h.bubbles.map((b) => ({ ...b, committed: true, staged: false })),
              commitReady: false,
            }
          : h,
      ),
    )
  }

  function clearSessionHighlights(sessionId: string) {
    setHighlights((prev) => prev.filter((h) => h.sessionId !== sessionId))
    if (sessionId === activeSessionId) {
      setActiveHighlightId(null)
    }
  }

  const currentSessionHighlights = useMemo(
    () => highlights.filter((h) => h.sessionId === activeSessionId),
    [highlights, activeSessionId],
  )

  const highlightCountsBySession = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const h of highlights) {
      counts[h.sessionId] = (counts[h.sessionId] ?? 0) + 1
    }
    return counts
  }, [highlights])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const activeHighlight = highlights.find((h) => h.id === activeHighlightId) ?? null
  const activeChatHistory = activeHighlight?.chatHistory ?? []

  return (
    <div className="flex h-full overflow-hidden">
      <SessionsPanel
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onClearSession={clearSessionHighlights}
        loading={loadingSessions}
        error={error}
        highlightCountsBySession={highlightCountsBySession}
        isCollapsed={isSessionsCollapsed}
        onToggleCollapsed={() => {
          setIsSessionsCollapsed((v) => {
            const next = !v
            if (!next) setLensPaneExpanded(false)  // opening sessions → close lens
            return next
          })
        }}
      />
      <ReadingPane
        session={activeSession}
        text={sessionText}
        loading={loadingText}
        highlights={currentSessionHighlights}
        activeHighlightId={activeHighlightId}
        onAddHighlight={addHighlight}
        onDeleteHighlight={deleteHighlight}
        onSetActiveHighlight={setActiveHighlightId}
        onScroll={autoCollapseSessions}
        isLensExpanded={lensPaneExpanded}
      />
      <InYourOwnWordsPane
        highlights={currentSessionHighlights}
        activeHighlightId={activeHighlightId}
        onSetActiveHighlight={setActiveHighlightId}
        onAddBubble={addBubble}
        onUpdateBubble={updateBubble}
        onDeleteBubble={deleteBubble}
        commitReady={activeHighlight?.commitReady ?? false}
        facilitatorLoading={facilitatorLoading}
        onCommit={commitHighlight}
      />
      <div className="flex min-w-[300px] flex-1 flex-col">
        <FacilitatorChat
          messages={activeChatHistory}
          loading={facilitatorLoading}
          onSend={sendChatMessage}
          hasActiveHighlight={activeHighlightId !== null}
        />
      </div>
      <LensPane
        personas={personas}
        hasActiveHighlight={activeHighlightId !== null}
        onInvokeLens={invokeLens}
        invokingPersonaId={invokingPersonaId}
        expanded={lensPaneExpanded}
        onToggleExpanded={() => {
          setLensPaneExpanded((v) => {
            const next = !v
            if (next) setIsSessionsCollapsed(true)  // opening lens → close sessions
            return next
          })
        }}
      />
    </div>
  )
}
