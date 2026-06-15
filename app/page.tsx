"use client"

import { useCallback, useState } from "react"
import { Menu, X, PanelLeft } from "lucide-react"
import { GaiaSidebar } from "@/components/gaia-sidebar"
import { GaiaChat } from "@/components/gaia-chat"
import { GaiaWindow, ComingSoonOverlay, WINDOW_REGISTRY, type WindowState } from "@/components/gaia-window"
import { GaiaProvider, useGaia } from "@/lib/gaia-context"
import { cn } from "@/lib/utils"

const WINDOW_TOOLS = new Set(["settings", "usage", "notes", "calendar"])

function GaiaApp() {
  const { settings, setActiveChatId, addChat } = useGaia()
  const [active, setActive] = useState("chats")
  const [micOn, setMicOn] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [windows, setWindows] = useState<WindowState[]>([])
  const [topZ, setTopZ] = useState(10)
  const [comingSoon, setComingSoon] = useState<string | null>(null)

  const openWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const nextZ = topZ + 1
      setTopZ(nextZ)
      const existing = prev.find((w) => w.id === id)
      if (existing) return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: nextZ } : w))
      const offset = prev.length * 28
      return [...prev, { id, minimized: false, x: 48 + offset, y: 36 + offset, z: nextZ }]
    })
  }, [topZ])

  const closeWindow = useCallback((id: string) => setWindows((prev) => prev.filter((w) => w.id !== id)), [])
  const minimizeWindow = useCallback((id: string) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))), [])
  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const nextZ = topZ + 1
      setTopZ(nextZ)
      return prev.map((w) => (w.id === id ? { ...w, z: nextZ } : w))
    })
  }, [topZ])
  const moveWindow = useCallback((id: string, x: number, y: number) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w))), [])

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
    if (id === "chats" || id === "new-chat") return
    if (WINDOW_TOOLS.has(id)) { openWindow(id) } else { setComingSoon(id) }
  }

  const minimized = windows.filter((w) => w.minimized)

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden w-72 shrink-0 border-r border-border lg:block">
        <GaiaSidebar active={active} onSelect={handleSelect} micOn={micOn} voiceOn={voiceOn}
          onToggleMic={() => setMicOn((v) => !v)} onToggleVoice={() => setVoiceOn((v) => !v)}
          onNewChat={handleNewChat} />
      </div>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-[100] lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div onClick={() => setMobileOpen(false)} className={cn("absolute inset-0 bg-black/60 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} />
        <div className={cn("absolute inset-y-0 left-0 w-72 border-r border-border transition-transform", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <button type="button" onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-4 z-10 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="size-5" />
          </button>
          <GaiaSidebar active={active} onSelect={handleSelect} micOn={micOn} voiceOn={voiceOn}
            onToggleMic={() => setMicOn((v) => !v)} onToggleVoice={() => setVoiceOn((v) => !v)}
            onNewChat={handleNewChat} />
        </div>
      </div>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent lg:hidden">
            <Menu className="size-5" />
          </button>
          <PanelLeft className="hidden size-[18px] text-muted-foreground lg:block" />
          <div className="flex flex-col leading-tight">
            <h1 className="text-sm font-semibold capitalize text-foreground">
              {active === "chats" ? "Chat" : active.replace("-", " ")}
            </h1>
            <span className="text-xs text-muted-foreground">
              {settings.assistantName} · {settings.model === "fable" ? "Fable 5" : settings.model.charAt(0).toUpperCase() + settings.model.slice(1)}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-primary" />Online
            </span>
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">LB</div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <GaiaChat micOn={micOn} />

          {comingSoon && <ComingSoonOverlay id={comingSoon} onClose={() => setComingSoon(null)} />}

          {windows.map((w) => (
            <GaiaWindow key={w.id} state={w} meta={WINDOW_REGISTRY[w.id]} onClose={closeWindow}
              onMinimize={minimizeWindow} onFocus={focusWindow} onMove={moveWindow} />
          ))}

          {minimized.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[90] flex justify-center px-4">
              <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-card/90 p-1.5 shadow-xl backdrop-blur">
                {minimized.map((w) => {
                  const meta = WINDOW_REGISTRY[w.id]
                  const Icon = meta.icon
                  return (
                    <div key={w.id} className="flex shrink-0 items-center">
                      <button type="button" onClick={() => openWindow(w.id)}
                        className="flex min-h-9 items-center gap-2 rounded-l-xl rounded-r-none bg-secondary/70 px-3 text-xs font-medium text-foreground hover:bg-secondary">
                        <Icon className="size-4 text-primary" />{meta.label}
                      </button>
                      <button type="button" onClick={() => closeWindow(w.id)}
                        className="flex min-h-9 items-center rounded-l-none rounded-r-xl bg-secondary/70 pl-1 pr-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
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
    </div>
  )
}

export default function Page() {
  return <GaiaProvider><GaiaApp /></GaiaProvider>
}