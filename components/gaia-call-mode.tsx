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

// Palabras que cuentan como "cállate" cuando Luis las dice mientras Gaia habla
const INTERRUPT_WORDS = new Set(["espera", "esperate", "calla", "callate", "detente", "basta", "alto", "oye", "silencio"])

// Normaliza una palabra para compararla (minúsculas, sin acentos ni signos)
const normalizeWord = (w: string) =>
  w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")

// Parte un texto largo en trozos cortos por oraciones. Chrome corta la voz
// si una sola frase dura mucho, y iOS se duerme; con trozos cortos ambos
// problemas desaparecen y Gaia puede leer textos largos completos.
const splitIntoChunks = (text: string, max = 220): string[] => {
  const clean = text.replace(/[ \t]+/g, " ").trim()
  const sentences = clean.match(/[^.!?…\n]+[.!?…]*\s*/g) || [clean]
  const chunks: string[] = []
  let cur = ""
  for (const s of sentences) {
    if (cur && (cur + s).length > max) {
      chunks.push(cur.trim())
      cur = s
    } else {
      cur += s
    }
  }
  if (cur.trim()) chunks.push(cur.trim())

  // Si alguna oración sola es muy larga, se parte por palabras
  const result: string[] = []
  for (const c of chunks) {
    if (c.length <= max * 1.5) {
      result.push(c)
      continue
    }
    let piece = ""
    for (const word of c.split(" ")) {
      if (piece && (piece + " " + word).length > max) {
        result.push(piece)
        piece = word
      } else {
        piece = piece ? piece + " " + word : word
      }
    }
    if (piece) result.push(piece)
  }
  return result.filter(Boolean)
}

export function GaiaCallMode({ onExit }: { onExit: () => void }) {
  const { settings, activeChatId, addUsage, updateChatTitle } = useGaia()

  const [status, setStatus] = useState<CallStatus>("listening")
  const [uiVisible, setUiVisible] = useState(true)
  const [transcript, setTranscript] = useState("")
  const [debugError, setDebugError] = useState("")

  const statusRef = useRef<CallStatus>("listening")
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef("")
  const isMountedRef = useRef(true)
  const loopGuardRef = useRef(0)
  const loopGuardResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Interrupción: reconocimiento que escucha mientras Gaia habla
  const bargeRecRef = useRef<any>(null)
  const bargeActiveRef = useRef(false)
  // Cada vez que Gaia empieza a hablar o la interrumpen, este contador sube
  // e invalida los callbacks de la voz anterior.
  const speakGenRef = useRef(0)

  const setStatusBoth = useCallback((s: CallStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const stopBargeIn = useCallback(() => {
    bargeActiveRef.current = false
    try { bargeRecRef.current?.stop() } catch {}
    bargeRecRef.current = null
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
    speakGenRef.current += 1
    stopBargeIn()
    try { recognitionRef.current?.stop() } catch {}
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (loopGuardResetTimerRef.current) clearTimeout(loopGuardResetTimerRef.current)
    try { window.speechSynthesis.cancel() } catch {}
    onExit()
  }, [onExit, stopBargeIn])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleExit()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleExit])

  const startListeningRef = useRef<(seed?: string) => void>(() => {})

  // seed: texto que Luis ya alcanzó a decir mientras interrumpía a Gaia
  const startListening = useCallback((seed?: string) => {
    if (!isMountedRef.current) return

    loopGuardRef.current += 1
    if (loopGuardRef.current > 8) {
      console.warn("[GAIA DEBUG] Reinicios frecuentes del micrófono, pausando.")
      setStatusBoth("idle")
      return
    }

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

    const seedText = seed?.trim() || ""
    finalTranscriptRef.current = seedText ? seedText + " " : ""
    setTranscript(seedText)
    setStatusBoth("listening")

    let lastInterim = ""

    recognition.onresult = (event: any) => {
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
        if (!finalTranscriptRef.current.trim() && lastInterim.trim()) {
          finalTranscriptRef.current = lastInterim
        }
        try { recognition.stop() } catch {}
      }, 1400)
    }

    recognition.onend = () => {
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
        return
      }
      console.error("[GAIA DEBUG] recognition.onerror:", event.error)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      console.error("[GAIA DEBUG] recognition.start() lanzó excepción:", err)
    }

    // Si venía de una interrupción y Luis ya no dice más, igual se envía lo que dijo
    if (seedText) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        try { recognition.stop() } catch {}
      }, 1800)
    }
  }, [settings.language, setStatusBoth])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  // ── Interrupción: escucha mientras Gaia habla y la calla si Luis habla ──
  // Ojo: el micrófono también capta la voz de Gaia por las bocinas. Para no
  // interrumpirse sola, solo cuenta como interrupción si lo escuchado trae
  // palabras que Gaia NO está diciendo. Con audífonos funciona mucho mejor.
  const startBargeIn = useCallback((spokenText: string, gen: number) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    let recognition: any
    try {
      recognition = new SpeechRecognition()
    } catch {
      return
    }

    recognition.lang = settings.language === "es" ? "es-MX" : "en-US"
    recognition.continuous = true
    recognition.interimResults = true

    const spoken = new Set(spokenText.split(/\s+/).map(normalizeWord).filter(Boolean))
    bargeActiveRef.current = true

    recognition.onresult = (event: any) => {
      if (speakGenRef.current !== gen || !bargeActiveRef.current) return

      let heard = ""
      for (let i = 0; i < event.results.length; i++) {
        heard += event.results[i][0].transcript + " "
      }

      const tokens = heard.split(/\s+/).filter(Boolean)
      const norm = tokens.map(normalizeWord)
      const novel = norm.filter((w) => w && !spoken.has(w))

      if (novel.length >= 2 || novel.some((w) => INTERRUPT_WORDS.has(w))) {
        // Se queda solo con lo que dijo Luis, desde la primera palabra que no es de Gaia
        const firstNovel = norm.findIndex((w) => w && !spoken.has(w))
        const seed = tokens.slice(Math.max(firstNovel, 0)).join(" ")

        speakGenRef.current += 1
        stopBargeIn()
        try { window.speechSynthesis.cancel() } catch {}
        setTimeout(() => {
          if (isMountedRef.current) startListeningRef.current(seed)
        }, 150)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        bargeActiveRef.current = false
      }
    }

    // Chrome cierra el reconocimiento solo cada cierto tiempo: se reinicia
    // mientras Gaia siga hablando.
    recognition.onend = () => {
      if (
        isMountedRef.current &&
        bargeActiveRef.current &&
        speakGenRef.current === gen &&
        statusRef.current === "speaking"
      ) {
        try { recognition.start() } catch {}
      }
    }

    bargeRecRef.current = recognition
    try {
      recognition.start()
    } catch {
      bargeActiveRef.current = false
    }
  }, [settings.language, stopBargeIn])

  // ── Voz: Web Speech API del navegador (gratis, local, sin límites) ──
  // Lee el texto por trozos para que los textos largos se escuchen completos.
  const speak = useCallback((text: string) => {
    setStatusBoth("speaking")
    setDebugError("")

    if (!("speechSynthesis" in window)) {
      setDebugError("este navegador no soporta voz")
      startListeningRef.current()
      return
    }

    try {
      window.speechSynthesis.cancel()

      const gen = ++speakGenRef.current
      const chunks = splitIntoChunks(text)
      const lang = settings.language === "es" ? "es-MX" : "en-US"

      const voices = window.speechSynthesis.getVoices()
      const spanishFemale = voices.find(
        (v) => v.lang.startsWith("es") && /female|mujer|maria|paulina|monica|mónica|sabina/i.test(v.name)
      )
      const anySpanish = voices.find((v) => v.lang.startsWith("es"))
      const voice = spanishFemale || anySpanish || null

      let finished = false
      const finish = (reason: string) => {
        if (finished || speakGenRef.current !== gen) return
        finished = true
        stopBargeIn()
        if (reason.startsWith("onerror")) setDebugError(`voz: ${reason}`)
        if (!isMountedRef.current) return
        startListeningRef.current()
      }

      let idx = 0
      const speakNext = () => {
        if (speakGenRef.current !== gen || finished) return
        if (idx >= chunks.length) {
          finish("onend")
          return
        }

        const chunk = chunks[idx++]
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = lang
        utterance.rate = 1.0
        utterance.pitch = 1.0
        if (voice) utterance.voice = voice

        let advanced = false
        const advance = () => {
          if (advanced) return
          advanced = true
          clearTimeout(safety)
          speakNext()
        }

        // Red de seguridad: si Safari nunca dispara onend (bug conocido en iOS),
        // se avanza al siguiente trozo según su longitud para no quedarse trabado.
        const safety = setTimeout(advance, Math.max(3000, chunk.length * 90))

        utterance.onend = advance
        utterance.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return
          clearTimeout(safety)
          finish(`onerror:${e.error}`)
        }

        window.speechSynthesis.speak(utterance)
      }

      speakNext()
      startBargeIn(text, gen)
    } catch (err: any) {
      setDebugError(`error de voz: ${err?.message || String(err)}`)
      if (isMountedRef.current) startListeningRef.current()
    }
  }, [settings.language, setStatusBoth, startBargeIn, stopBargeIn])

  const sendToGaiaRef = useRef<(text: string) => void>(() => {})

  const sendToGaia = useCallback(async (text: string) => {
    const trimmed = text.trim()

    if (!trimmed || !activeChatId) {
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

    // Desbloquea la voz en iOS Safari: una utterance vacía lanzada desde el
    // toque que abrió el modo llamada permite que las siguientes suenen.
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""))
      // Precargar voces del navegador (en iOS a veces tardan en poblarse)
      window.speechSynthesis.getVoices()
    } catch {}

    startListening()
    return () => {
      isMountedRef.current = false
      speakGenRef.current += 1
      stopBargeIn()
      try { recognitionRef.current?.stop() } catch {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (loopGuardResetTimerRef.current) clearTimeout(loopGuardResetTimerRef.current)
      try { window.speechSynthesis.cancel() } catch {}
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
        {debugError && (
          <p className="max-w-md break-all text-center text-xs text-yellow-400">
            {debugError}
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