"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ArrowUp, Mic, Paperclip, Sparkle, Plus, AlertCircle, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGaia } from "@/lib/gaia-context"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export function GaiaChat({ micOn }: { micOn: boolean }) {
  const { settings, sessionUsage, addUsage, setChatCount, activeChatId, setActiveChatId, addChat, updateChatTitle } = useGaia()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFirstMessage, setIsFirstMessage] = useState(true)

  // Voz
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detectar soporte de voz
  useEffect(() => {
    if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      setVoiceSupported(true)
    }
  }, [])

  // Inicializar reconocimiento de voz
  const initRecognition = useCallback(() => {
    if (!voiceSupported) return null
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = settings.language === "es" ? "es-MX" : "en-US"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("")
      setInput(transcript)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error)
      setListening(false)
      if (event.error === "not-allowed") {
        setError("Permiso de micrófono denegado. Actívalo en tu navegador.")
      }
    }

    return recognition
  }, [voiceSupported, settings.language])

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = initRecognition()
    if (!recognition) return
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    setError(null)
  }, [listening, initRecognition])

  // Sin auto-envío — el usuario decide cuándo mandar

  // Crear nuevo chat al montar
  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { method: "PUT" })
      const data = await res.json()
      if (data.chat) {
        setActiveChatId(data.chat.id)
        addChat(data.chat)
        setMessages([{ id: "welcome", role: "assistant", content: "Luis. Ya era hora.\n\nSoy Gaia. Escríbeme." }])
        setIsFirstMessage(true)
      }
    } catch (e) {
      console.error("Error creating chat:", e)
    }
  }, [setActiveChatId, addChat])

  const loadChatHistory = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/messages?chatId=${chatId}`)
      const data = await res.json()
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })))
        setIsFirstMessage(false)
      } else {
        setMessages([{ id: "welcome", role: "assistant", content: "Luis. Ya era hora.\n\nSoy Gaia. Escríbeme." }])
        setIsFirstMessage(true)
      }
    } catch (e) {
      console.error("Error loading history:", e)
    }
  }, [])

  useEffect(() => {
    if (activeChatId) {
      loadChatHistory(activeChatId)
    } else {
      createNewChat()
    }
  }, [activeChatId])

  useEffect(() => {
    setChatCount(messages.filter((m) => m.role === "user").length)
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
    if (!trimmed || loading || !activeChatId) return

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, model: settings.model, temperature: settings.temperature, chatId: activeChatId, isFirstMessage }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error desconocido")

      const reply = data.reply
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: reply }])

      if (data.chatTitle) updateChatTitle(activeChatId, data.chatTitle)
      if (isFirstMessage) setIsFirstMessage(false)
      if (data.usage) addUsage(data.usage.inputTokens, data.usage.outputTokens, parseFloat(data.usage.cost))
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con Gaia.")
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setInput(trimmed)
    } finally {
      setLoading(false)
    }
  }

  const modelLabel: Record<string, string> = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus", fable: "Fable 5" }
  const showStats = sessionUsage.messages > 0

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {message.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkle className="size-4" />
                </div>
              )}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground")}>
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkle className="size-4 animate-pulse" />
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

      {/* Indicador de escucha */}
      {listening && (
        <div className="flex items-center justify-center gap-2 border-t border-border/50 bg-primary/5 py-2 text-xs text-primary">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Escuchando... habla ahora
        </div>
      )}

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
          <form onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/20 focus-within:border-primary/50">
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              rows={1} placeholder={listening ? "Dictando..." : "Message Gaia…"} disabled={loading}
              className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50" />
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-1">
                <button type="button" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Paperclip className="size-[18px]" />
                </button>
                <button type="button" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Plus className="size-[18px]" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {voiceSupported && (
                  <button type="button" onClick={toggleListening}
                    className={cn("flex size-9 items-center justify-center rounded-lg transition-colors",
                      listening ? "bg-primary text-primary-foreground animate-pulse" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    {listening ? <MicOff className="size-[18px]" /> : <Mic className="size-[18px]" />}
                  </button>
                )}
                <button type="submit" disabled={!input.trim() || loading}
                  className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
                  <ArrowUp className="size-[18px]" />
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