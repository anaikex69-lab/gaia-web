"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, PanelLeft } from "lucide-react"
import { GaiaSidebar } from "@/components/gaia-sidebar"
import { GaiaChat } from "@/components/gaia-chat"
import { GaiaCallMode } from "@/components/gaia-call-mode"
import { GaiaWindow, ComingSoonOverlay, WINDOW_REGISTRY, type WindowState } from "@/components/gaia-window"
import { GaiaProvider, useGaia } from "@/lib/gaia-context"
import { LoginScreen } from "@/components/login-screen"
import { cn } from "@/lib/utils"

const WINDOW_TOOLS = new Set(["settings", "usage", "notes", "calendar", "tasks", "memory"])

function GaiaApp() {
  const { settings, updateSettings, setActiveChatId, addChat } = useGaia()
  const [active, setActive] = useState("chats")
  const [micOn, setMicOn] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [callModeOpen, setCallModeOpen] = useState(false)
  const [windows, setWindows] = useState<WindowState[]>([])
  const [topZ, setTopZ] = useState(10)
  const [comingSoon, setComingSoon] = useState<string | null>(null)

  const dragStartX = useRef<number | null>(null)
  const edgeRef = useRef<HTMLDivElement>(null)

  const onEdgePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartX.current = e.clientX
  }, [])

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (dragStartX.current === null) return
      const delta = e.clientX - dragStartX.current
      if (delta > 60) {
        setSidebarOpen(true)
        dragStartX.current = null
      }
    }
    function onPointerUp() {
      dragStartX.current = null
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings && Object.keys(d.settings).length > 0) {
          const s = d.settings
          updateSettings({
            model: s.model || "sonnet",
            temperature: parseFloat(s.temperature || "0.7"),
            mode: s.mode || "casual",
            language: s.language || "es",
            assistantName: s.assistantName || "Gaia",
            avatarUrl: s.avatarUrl || "",
          })
        }
      })
      .catch(console.error)
  }, [])

  const openWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const nextZ = topZ + 1
      setTopZ(nextZ)
      const existing = prev.find((w) => w.id === id)
      if (existing) {
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: nextZ } : w))
      }
      const offset = prev.length * 28
      return [...prev, { id, minimized: false, x: 48 + offset, y: 36 + offset, z: nextZ }]
    })
  }, [topZ])

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }, [])

  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const nextZ = topZ + 1
      setTopZ(nextZ)
      return prev.map((w) => (w.id === id ? { ...w, z: nextZ } : w))
    })
  }, [topZ])

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)))
  }, [])

  async function handleNewChat() {
    try {
      const res = await fetch("/api/chat", { method: "PUT" })
      const data = await res.json()
      if (data.chat) {
        addChat(data.chat)
        setActiveChatId(data.chat.id)
        setActive("chats")
        setMobileOpen(false)
      }
    } catch (e) {
      console.error("Error creating chat:", e)
    }
  }

  function handleSelect(id: string) {
    setActive(id)
    setMobileOpen(false)
    if (id === "chats" || id === "new-chat") {
      return
    }
    if (WINDOW_TOOLS.has(id)) {
      openWindow(id)
    } else {
      setComingSoon(id)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      }).catch(console.error)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [settings])

  const minimized = windows.filter((w) => w.minimized)

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {!sidebarOpen && (
        <div
          ref={edgeRef}
          onPointerDown={onEdgePointerDown}
          className="fixed inset-y-0 left-0 z-40 w-3 cursor-ew-resize lg:block hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
        className={cn(
          "fixed top-4 z-[120] flex size-9 items-center justify-center rounded-full border transition-all duration-300",
          "border-primary/20 bg-background/40 text-primary/50 backdrop-blur-md hover:border-primary/50 hover:text-primary hover:bg-background/70",
          sidebarOpen ? "left-[296px] lg:left-[296px]" : "left-4"
        )}
      >
        <PanelLeft className="size-4" />
      </button>

      <div
        className={cn(
          "hidden h-full shrink-0 overflow-hidden border-r border-border transition-all duration-300 lg:block",
          sidebarOpen ? "w-72" : "w-0 border-r-0"
        )}
      >
        <div className="h-full w-72">
          <GaiaSidebar
            active={active}
            onSelect={handleSelect}
            micOn={micOn}
            voiceOn={voiceOn}
            onToggleMic={() => setCallModeOpen(true)}
            onToggleVoice={() => setVoiceOn((v) => !v)}
            onNewChat={handleNewChat}
          />
        </div>
      </div>

      <div className={cn("fixed inset-0 z-[100] lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn("absolute inset-0 bg-black/60 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 border-r border-border transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-4 z-10 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="size-5" />
          </button>
          <GaiaSidebar
            active={active}
            onSelect={handleSelect}
            micOn={micOn}
            voiceOn={voiceOn}
            onToggleMic={() => setCallModeOpen(true)}
            onToggleVoice={() => setVoiceOn((v) => !v)}
            onNewChat={handleNewChat}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mostrar panel"
        className="fixed left-4 top-4 z-[120] flex size-9 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-primary/50 backdrop-blur-md lg:hidden"
      >
        <PanelLeft className="size-4" />
      </button>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {!callModeOpen && <GaiaChat micOn={micOn} />}

          {comingSoon && <ComingSoonOverlay id={comingSoon} onClose={() => setComingSoon(null)} />}

          {windows.map((w) => (
            <GaiaWindow
              key={w.id}
              state={w}
              meta={WINDOW_REGISTRY[w.id]}
              onClose={closeWindow}
              onMinimize={minimizeWindow}
              onFocus={focusWindow}
              onMove={moveWindow}
            />
          ))}

          {minimized.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[90] flex justify-center px-4">
              <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-card/90 p-1.5 shadow-xl backdrop-blur">
                {minimized.map((w) => {
                  const meta = WINDOW_REGISTRY[w.id]
                  const Icon = meta.icon
                  return (
                    <div key={w.id} className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => openWindow(w.id)}
                        className="flex min-h-9 items-center gap-2 rounded-l-xl rounded-r-none bg-secondary/70 px-3 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        <Icon className="size-4 text-primary" />
                        {meta.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => closeWindow(w.id)}
                        className="flex min-h-9 items-center rounded-l-none rounded-r-xl bg-secondary/70 pl-1 pr-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {callModeOpen && <GaiaCallMode onExit={() => setCallModeOpen(false)} />}
    </div>
  )
}

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("gaia-auth-token")
    setAuthed(!!token)
  }, [])

  if (authed === null) {
    return null
  }

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />
  }

  return (
    <GaiaProvider>
      <GaiaApp />
    </GaiaProvider>
  )
}