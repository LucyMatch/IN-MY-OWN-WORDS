import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bubble, ChatMessage, CommitCheckRequest, CommitCheckResponse, ConsultRequest, ConsultResponse, FacilitatorRequest, FacilitatorResponse, Highlight, Session, VerifyRequest, VerifyResponse } from '@shared/types'
import { loadHighlights, saveHighlights } from '@/lib/persistence'
import { SessionsPanel } from '@/components/prototype/SessionsPanel'
import { ReadingPane } from '@/components/prototype/ReadingPane'
import { InYourOwnWordsPane } from '@/components/prototype/InYourOwnWordsPane'
import { FacilitatorChat } from '@/components/prototype/FacilitatorChat'
import { BuddyPanel } from '@/components/prototype/BuddyPanel'

export function PrototypeSlide() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionText, setSessionText] = useState<string>('')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingText, setLoadingText] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [facilitatorLoading, setFacilitatorLoading] = useState(false)
  const [consultingHighlights, setConsultingHighlights] = useState<Set<string>>(new Set())

  // Ref so async synthesis calls can read the latest chatHistory without
  // going stale inside their closure. We update it on every render.
  const chatHistoryRef = useRef<ChatMessage[]>(chatHistory)
  useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])

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
    setChatHistory([])
  }, [activeSessionId])

  function addHighlight(h: Highlight) {
    setHighlights((prev) => [...prev, h])
    setActiveHighlightId(h.id)
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

    const syntheticUserMessage: ChatMessage = {
      role: 'user',
      content: `[staged: '${focusBubble.text}']`,
      kind: 'synthesis',
    }

    // Build the updated history before setState — we need it for the API call
    const historyBeforeCall = [...chatHistoryRef.current, syntheticUserMessage]
    setChatHistory(historyBeforeCall)
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
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: errMsg, kind: 'chat' },
        ])
        return
      }

      const facilitatorData = (await facilitatorRes.json()) as FacilitatorResponse
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: facilitatorData.text,
        kind: 'synthesis',
      }
      setChatHistory((prev) => [...prev, assistantMessage])

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
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.', kind: 'chat' },
      ])
    } finally {
      setFacilitatorLoading(false)
    }
  }

  async function sendChatMessage(text: string) {
    const userMessage: ChatMessage = { role: 'user', content: text, kind: 'chat' }
    const historyBeforeCall = [...chatHistoryRef.current, userMessage]
    setChatHistory(historyBeforeCall)
    setFacilitatorLoading(true)

    try {
      const activeHighlight = highlights.find((h) => h.id === activeHighlightId)
      const body: FacilitatorRequest = {
        messages: historyBeforeCall,
        highlight: activeHighlight?.text,
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
        setChatHistory((prev) => [...prev, { role: 'assistant', content: errMsg, kind: 'chat' }])
        return
      }

      const data = (await res.json()) as FacilitatorResponse
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: data.text, kind: 'chat' },
      ])
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.', kind: 'chat' },
      ])
    } finally {
      setFacilitatorLoading(false)
    }
  }

  function addBubble(highlightId: string, text: string) {
    const newBubbleId = crypto.randomUUID()
    let updatedBubbles: Bubble[] = []
    let shouldConsult = false
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
        shouldConsult = h.bubbles.length === 0 && h.buddyResponses.length === 0
        return { ...h, bubbles: updatedBubbles, commitReady: false }
      }),
    )

    void sendSynthesisTurn(highlightId, newBubbleId, highlightText, updatedBubbles)

    if (shouldConsult) {
      void sendConsult(highlightId, highlightText, updatedBubbles.map((b) => b.text))
    }
  }

  async function sendConsult(highlightId: string, highlightText: string, bubbleTexts: string[]) {
    setConsultingHighlights((prev) => new Set(prev).add(highlightId))

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlight: highlightText, bubbles: bubbleTexts } satisfies ConsultRequest),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Consult failed')
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId
              ? {
                  ...h,
                  buddyResponses: [
                    ...h.buddyResponses,
                    { id: crypto.randomUUID(), buddyId: 'unknown', error: errText, createdAt: new Date().toISOString() },
                  ],
                }
              : h,
          ),
        )
        return
      }

      const data = (await response.json()) as ConsultResponse

      for (let i = 0; i < data.responses.length; i++) {
        const resp = data.responses[i]
        await new Promise((r) => setTimeout(r, i === 0 ? 0 : 250))
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === highlightId
              ? {
                  ...h,
                  buddyResponses: [
                    ...h.buddyResponses,
                    {
                      id: crypto.randomUUID(),
                      buddyId: resp.buddyId,
                      buddyName: resp.buddyName,
                      text: resp.text,
                      error: resp.error,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : h,
          ),
        )
      }
    } finally {
      setConsultingHighlights((prev) => {
        const next = new Set(prev)
        next.delete(highlightId)
        return next
      })
    }
  }

  async function reRunBuddy(highlightId: string, buddyId: string) {
    const h = highlights.find((x) => x.id === highlightId)
    if (!h) return

    const bubbleTexts = h.bubbles.map((b) => b.text)

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlight: h.text, bubbles: bubbleTexts } satisfies ConsultRequest),
      })
      if (!response.ok) return
      const data = (await response.json()) as ConsultResponse
      const matching = data.responses.find((r) => r.buddyId === buddyId)
      if (!matching) return

      setHighlights((prev) =>
        prev.map((x) =>
          x.id === highlightId
            ? {
                ...x,
                buddyResponses: [
                  ...x.buddyResponses,
                  {
                    id: crypto.randomUUID(),
                    buddyId: matching.buddyId,
                    buddyName: matching.buddyName,
                    text: matching.text,
                    error: matching.error,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : x,
        ),
      )
    } catch {
      // Silent fail for re-run; user can click again
    }
  }

  async function verifyBuddyResponse(highlightId: string, responseId: string) {
    const h = highlights.find((x) => x.id === highlightId)
    if (!h) return
    const resp = h.buddyResponses.find((r) => r.id === responseId)
    if (!resp || !resp.text) return

    setHighlights((prev) =>
      prev.map((x) =>
        x.id === highlightId
          ? {
              ...x,
              buddyResponses: x.buddyResponses.map((r) =>
                r.id === responseId ? { ...r, verifying: true } : r,
              ),
            }
          : x,
      ),
    )

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highlight: h.text,
          originalResponse: resp.text,
          buddyId: resp.buddyId,
        } satisfies VerifyRequest),
      })

      if (!response.ok) {
        setHighlights((prev) =>
          prev.map((x) =>
            x.id === highlightId
              ? {
                  ...x,
                  buddyResponses: x.buddyResponses.map((r) =>
                    r.id === responseId ? { ...r, verifying: false } : r,
                  ),
                }
              : x,
          ),
        )
        return
      }

      const data = (await response.json()) as VerifyResponse

      setHighlights((prev) =>
        prev.map((x) =>
          x.id === highlightId
            ? {
                ...x,
                buddyResponses: x.buddyResponses.map((r) =>
                  r.id === responseId ? { ...r, verification: data.text, verifying: false } : r,
                ),
              }
            : x,
        ),
      )
    } catch {
      setHighlights((prev) =>
        prev.map((x) =>
          x.id === highlightId
            ? {
                ...x,
                buddyResponses: x.buddyResponses.map((r) =>
                  r.id === responseId ? { ...r, verifying: false } : r,
                ),
              }
            : x,
        ),
      )
    }
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

  function deleteBuddyResponse(highlightId: string, responseId: string) {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, buddyResponses: h.buddyResponses.filter((r) => r.id !== responseId) }
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
      <div className="border-border-soft flex w-[360px] flex-shrink-0 flex-col border-l">
        <FacilitatorChat
          messages={chatHistory}
          loading={facilitatorLoading}
          onSend={sendChatMessage}
        />
        <BuddyPanel
          activeHighlight={activeHighlight}
          isConsulting={activeHighlightId !== null && consultingHighlights.has(activeHighlightId)}
          onVerify={verifyBuddyResponse}
          onReRun={reRunBuddy}
          onDeleteResponse={deleteBuddyResponse}
        />
      </div>
    </div>
  )
}
