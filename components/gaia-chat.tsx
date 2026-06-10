"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Mic, Paperclip, Sparkle, Plus, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGaia } from "@/lib/gaia-context"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

type GaiaChatProps = {
  micOn: boolean
}

export function GaiaChat({ micOn }: GaiaChatProps) {
  const { settings, sessionUsage, addUsage, setChatCount } = useGaia()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Luis. Ya era hora.\n\nSoy Gaia. Escríbeme.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const userMsgs = messages.filter((m) => m.role === "user").length
    setChatCount(userMsgs)
  }, [messages, setChatCount])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [input])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          model: settings.model,
          temperature: settings.temperature,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error desconocido")

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (data.usage) {
        addUsage(data.usage.inputTokens, data.usage.outputTokens, parseFloat(data.usage.cost))
      }
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con Gaia.")
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setInput(trimmed)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  const modelLabel: Record<string, string> = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus" }
  const showStats = sessionUsage.messages > 0

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {message.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkle className="size-4" aria-hidden="true" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
              )}>
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkle className="size-4 animate-pulse" aria-hidden="true" />
              </div>
              <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce [animation-delay:0ms]">•</span>
                  <span className="animate-bounce [animation-delay:150ms]">•</span>
                  <span className="animate-bounce [animation-delay:300ms]">•</span>
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {showStats && (
        <div className="border-t border-border/50 bg-card/30 px-4 py-1.5 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 text-[0.65rem] text-muted-foreground/70">
            <span>Modelo: <span className="text-muted-foreground">{modelLabel[settings.model]}</span></span>
            <span className="text-border">|</span>
            <span>Mensajes: <span className="text-muted-foreground">{sessionUsage.messages}</span></span>
            <span className="text-border">|</span>
            <span>Tokens: <span className="text-muted-foreground">{(sessionUsage.input + sessionUsage.output).toLocaleString()}</span></span>
            <span className="text-border">|</span>
            <span>Costo sesión: <span className="text-primary font-medium">${sessionUsage.cost.toFixed(5)} USD</span></span>
          </div>
        </div>
      )}

      <div className="px-4 pb-5 pt-2 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/20 focus-within:border-primary/50">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              rows={1}
              placeholder="Message Gaia…"
              aria-label="Message Gaia"
              disabled={loading}
              className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Add attachment" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Paperclip className="size-[18px]" aria-hidden="true" />
                </button>
                <button type="button" aria-label="New tool" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Plus className="size-[18px]" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Dictate" className={cn("flex size-9 items-center justify-center rounded-lg transition-colors", micOn ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <Mic className="size-[18px]" aria-hidden="true" />
                </button>
                <button type="submit" aria-label="Send message" disabled={!input.trim() || loading} className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
                  <ArrowUp className="size-[18px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">Gaia puede equivocarse. Verifica la información importante.</p>
        </div>
      </div>
    </div>
  )
}
