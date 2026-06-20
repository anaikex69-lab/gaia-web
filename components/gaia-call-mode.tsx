"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { GalaxyScene } from "@/components/galaxy/galaxy-scene"
import { useGaia } from "@/lib/gaia-context"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

type CallStatus = "listening" | "thinking" | "speaking" | "idle"

const STOP_PHRASES = ["detente", "deten", "para ya", "parale", "salir", "cierra esto", "stop"]

export function GaiaCallMode({ onExit }: { onExit: () => void }) {
  const { settings, activeChatId, addUsage, updateChatTitle } = useGaia()

  const [status, setStatus] = useState<CallStatus>("listening")
  const [uiVisible, setUiVisible] = useState(true)
  const [transcript, setTranscript] = useState("")

  const statusRef = useRef<CallStatus>("listening")
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef("")
  const isMountedRef = useRef(true)
  const loopGuardRef = useRef(0)
  const loopGuardResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setStatusBoth = useCallback((s: CallStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const showUI = useCallback(() => {
    setUiVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setUiVisible(false), 2500)
  }, [])

  useEffect(() => {
    showUI()
    function onActivity() { showUI() }
    window.addEventListener("mousemove", onActivity)
    window.addEventListener("touchstart", onActivity)
    return () => {
      window.removeEventListener("mousemove", onActivity)
      window.removeEventListener("touchstart", onActivity)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showUI])

  const handleExit = useCallback(() => {
    isMountedRef.current = false
    try { recognitionRef.current?.stop() } catch {}
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (loopGuardResetTimerRef.current) clearTimeout(loopGuardResetTimerRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    onExit()
  }, [onExit])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleExit()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleExit])

  const startListeningRef = useRef<() => void>(() => {})

  const startListening = useCallback(() => {
    if (!isMountedRef.current) return

    loopGuardRef.current += 1
    if (loopGuardRef.current > 8) {
      console.warn("[GAIA DEBUG] Reinicios frecuentes del micrófono, pausando.")
      setStatusBoth("idle")
      return
    }
    console.log("[GAIA DEBUG] startListening() iniciado, intento #" + loopGuardRef.current)

    // si pasan 4s sin volver a entrar aquí, asumimos que ya está escuchando bien y reseteamos el contador
    if (loopGuardResetTimerRef.current) clearTimeout(loopGuardResetTimerRef.current)
    loopGuardResetTimerRef.current = setTimeout(() => {
      loopGuardRef.current = 0
    }, 4000)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error("[GAIA DEBUG] SpeechRecognition no existe en este navegador/contexto")
      return
    }

    let recognition: any
    try {
      recognition = new SpeechRecognition()
    } catch (err) {
      console.error("[GAIA DEBUG] Error creando instancia de SpeechRecognition:", err)
      return
    }

    recognition.lang = settings.language === "es" ? "es-MX" : "en-US"
    recognition.continuous = true
    recognition.interimResults = true

    finalTranscriptRef.current = ""
    setTranscript("")
    setStatusBoth("listening")

    let lastInterim = ""

    recognition.onstart = () => {
      console.log("[GAIA DEBUG] recognition.onstart — el micrófono SÍ se activó correctamente")
    }

    recognition.onresult = (event: any) => {
      console.log("[GAIA DEBUG] recognition.onresult disparado, resultados:", event.results.length)
      let interim = ""
      let final = finalTranscriptRef.current

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += piece + " "
        } else {
          interim += piece
        }
      }

      finalTranscriptRef.current = final
      lastInterim = interim
      setTranscript(final + interim)

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        console.log("[GAIA DEBUG] Silencio detectado, deteniendo recognition. interim guardado:", lastInterim)
        if (!finalTranscriptRef.current.trim() && lastInterim.trim()) {
          finalTranscriptRef.current = lastInterim
        }
        try { recognition.stop() } catch {}
      }, 1400)
    }

    recognition.onend = () => {
      console.log("[GAIA DEBUG] recognition.onend disparado. finalTranscript:", JSON.stringify(finalTranscriptRef.current))
      if (!isMountedRef.current) return
      const finalText = finalTranscriptRef.current.trim()

      if (finalText) {
        sendToGaiaRef.current(finalText)
      } else if (statusRef.current === "listening") {
        startListeningRef.current()
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        console.log("[GAIA DEBUG] recognition.onerror (esperado):", event.error)
        return
      }
      console.error("[GAIA DEBUG] recognition.onerror (INESPERADO):", event.error)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      console.log("[GAIA DEBUG] recognition.start() llamado sin throw")
    } catch (err) {
      console.error("[GAIA DEBUG] recognition.start() lanzó excepción:", err)
    }
  }, [settings.language, setStatusBoth])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const speak = useCallback(async (text: string) => {
    console.log("[GAIA DEBUG] speak() llamado con texto:", text)
    setStatusBoth("speaking")
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      console.log("[GAIA DEBUG] /api/voice respondió status:", res.status)
      if (!res.ok) throw new Error("voice error")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (!isMountedRef.current) return
        startListeningRef.current()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (!isMountedRef.current) return
        startListeningRef.current()
      }
      await audio.play()
    } catch (err) {
      console.error("[GAIA DEBUG] Error reproduciendo voz:", err)
      if (isMountedRef.current) {
        startListeningRef.current()
      }
    }
  }, [setStatusBoth])

  const sendToGaiaRef = useRef<(text: string) => void>(() => {})

  const sendToGaia = useCallback(async (text: string) => {
    const trimmed = text.trim()
    console.log("[GAIA DEBUG] sendToGaia llamado con:", trimmed, "activeChatId:", activeChatId)

    if (!trimmed || !activeChatId) {
      console.log("[GAIA DEBUG] No hay texto o no hay activeChatId, regresando a escuchar")
      startListeningRef.current()
      return
    }

    const lower = trimmed.toLowerCase()
    if (STOP_PHRASES.some((p) => lower.includes(p))) {
      handleExit()
      return
    }

    setStatusBoth("thinking")
    setTranscript("")
    console.log("[GAIA DEBUG] Mandando fetch a /api/chat...")

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          model: settings.model,
          temperature: settings.temperature,
          chatId: activeChatId,
          isFirstMessage: false,
        }),
      })
      const data = await res.json()
      console.log("[GAIA DEBUG] Respuesta recibida:", res.status, data)
      if (!res.ok) throw new Error(data.error || "Error")

      if (data.chatTitle) updateChatTitle(activeChatId, data.chatTitle)
      if (data.usage) addUsage(data.usage.inputTokens, data.usage.outputTokens, parseFloat(data.usage.cost))

      if (isMountedRef.current) speak(data.reply)
    } catch (err) {
      console.error("[GAIA DEBUG] Error en modo conversación:", err)
      if (isMountedRef.current) {
        startListeningRef.current()
      }
    }
  }, [activeChatId, settings, speak, handleExit, addUsage, updateChatTitle, setStatusBoth])

  useEffect(() => {
    sendToGaiaRef.current = sendToGaia
  }, [sendToGaia])

  useEffect(() => {
    isMountedRef.current = true
    startListening()
    return () => {
      isMountedRef.current = false
      try { recognitionRef.current?.stop() } catch {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (loopGuardResetTimerRef.current) clearTimeout(loopGuardResetTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel: Record<CallStatus, string> = {
    listening: "Escuchando...",
    thinking: "Pensando...",
    speaking: "Hablando...",
    idle: "Pausado — recarga para reintentar",
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#03040a]">
      <div className="absolute inset-0">
        <GalaxyScene thinking={status === "thinking" || status === "speaking"} />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(120% 90% at 50% 50%, transparent 35%, rgba(3,4,10,0.5) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center gap-3 px-6">
        <span
          className={cn(
            "text-xs font-medium tracking-wide text-primary/70 transition-opacity duration-300",
            uiVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {statusLabel[status]}
        </span>
        {transcript && status === "listening" && (
          <p className="max-w-md text-center text-sm text-foreground/60 transition-opacity duration-300">
            {transcript}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleExit}
        aria-label="Salir del modo conversación"
        className={cn(
          "fixed right-5 top-5 z-[210] flex size-9 items-center justify-center rounded-full border transition-all duration-300",
          "border-primary/20 bg-background/40 text-primary/50 backdrop-blur-md hover:border-primary/50 hover:text-primary hover:bg-background/70",
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}