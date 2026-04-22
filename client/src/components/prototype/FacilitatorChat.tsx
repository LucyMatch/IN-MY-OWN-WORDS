import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@shared/types'

type FacilitatorChatProps = {
  messages: ChatMessage[]
  loading: boolean
  onSend: (text: string) => void
}

export function FacilitatorChat({ messages, loading, onSend }: FacilitatorChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, loading])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distanceFromBottom < 80
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
        <p className="text-text-tertiary text-xs uppercase tracking-widest">Chat</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scroll-area flex-1 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m, i) => <ChatBubble key={i} message={m} />)
        )}
        {loading && <TypingIndicator />}
      </div>

      <div className="border-border-subtle border-t p-3">
        <ChatInput onSend={onSend} disabled={loading} />
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      data-role={message.role}
      data-kind={message.kind ?? 'chat'}
      className={cn(
        'mb-3 max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug',
        isUser ? 'bg-user-bubble text-text-primary ml-auto' : 'text-text-primary',
      )}
    >
      {message.kind === 'synthesis' && isUser && (
        <p className="text-text-tertiary mb-1 text-xs">Staged:</p>
      )}
      <p className="whitespace-pre-line">{message.content}</p>
    </div>
  )
}

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  const canSend = value.trim().length > 0 && !disabled

  function handleSend() {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-surface shadow-input flex items-end rounded-xl">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about the passage…"
        rows={1}
        disabled={disabled}
        className="text-text-primary placeholder:text-text-tertiary flex-1 resize-none border-none bg-transparent px-3 py-2 text-sm leading-snug outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className="text-text-tertiary hover:text-text-primary m-1 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="text-text-tertiary mb-3 flex items-center gap-1 text-sm">
      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Ask anything about the passage. Stage a description to get focused feedback.</p>
    </div>
  )
}
