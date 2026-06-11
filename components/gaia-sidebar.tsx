"use client"

import type { LucideIcon } from "lucide-react"
import { useEffect } from "react"
import {
  Plus, Search, MessagesSquare, Brain, Sparkle, Library,
  Calendar, NotebookPen, ListTodo, Mail, GitCompareArrows,
  BookOpen, Telescope, Images, Palette, Settings, Mic, Volume2, VolumeX, BarChart3,
  MessageCircle, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGaia, type Chat } from "@/lib/gaia-context"

type NavItem = { id: string; label: string; icon: LucideIcon; badge?: string | number }
type NavSection = { heading: string; items: NavItem[] }

type GaiaSidebarProps = {
  active: string
  onSelect: (id: string) => void
  micOn: boolean
  voiceOn: boolean
  onToggleMic: () => void
  onToggleVoice: () => void
  onNewChat: () => void
}

export function GaiaSidebar({ active, onSelect, micOn, voiceOn, onToggleMic, onToggleVoice, onNewChat }: GaiaSidebarProps) {
  const { chatCount, sessionUsage, chats, setChats, activeChatId, setActiveChatId } = useGaia()

  // Cargar lista de chats al montar
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => { if (d.chats) setChats(d.chats) })
      .catch(console.error)
  }, [])

  const sections: NavSection[] = [
    {
      heading: "Conversaciones",
      items: [{ id: "chats", label: "Chats", icon: MessagesSquare, badge: chatCount > 0 ? chatCount : undefined }],
    },
    {
      heading: "El Núcleo de Gaia",
      items: [
        { id: "brain", label: "Brain", icon: Brain },
        { id: "memory", label: "Memory", icon: Sparkle },
        { id: "library", label: "Library", icon: Library },
      ],
    },
    {
      heading: "Productividad",
      items: [
        { id: "calendar", label: "Calendar", icon: Calendar },
        { id: "notes", label: "Notes", icon: NotebookPen },
        { id: "tasks", label: "Tasks", icon: ListTodo },
        { id: "email", label: "Email", icon: Mail },
      ],
    },
    {
      heading: "Herramientas Avanzadas",
      items: [
        { id: "compare", label: "Compare", icon: GitCompareArrows },
        { id: "cookbook", label: "Cookbook", icon: BookOpen },
        { id: "deep-research", label: "Deep Research", icon: Telescope },
        { id: "gallery", label: "Gallery", icon: Images },
      ],
    },
    {
      heading: "Personalización",
      items: [
        { id: "theme", label: "Theme", icon: Palette },
        { id: "usage", label: "Uso", icon: BarChart3, badge: sessionUsage.messages > 0 ? `$${sessionUsage.cost.toFixed(4)}` : undefined },
      ],
    },
    {
      heading: "Configuración",
      items: [{ id: "settings", label: "Configuración", icon: Settings }],
    },
  ]

  function handleChatSelect(chat: Chat) {
    setActiveChatId(chat.id)
    onSelect("chats")
  }

  async function deleteChat(e: React.MouseEvent, chatId: string) {
    e.stopPropagation()
    try {
      await fetch(`/api/messages?chatId=${chatId}`, { method: "DELETE" })
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      if (activeChatId === chatId) onNewChat()
    } catch (err) {
      console.error("Error deleting chat:", err)
    }
  }

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkle className="size-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-accent-foreground">Gaia</span>
          <span className="text-xs text-sidebar-foreground">AI Workspace</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3">
        <button type="button" onClick={onNewChat}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">
          <Plus className="size-4" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button type="button" onClick={() => onSelect("search")}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50">
          <Search className="size-4 shrink-0" />
          Search
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {/* Lista de chats recientes */}
        {chats.length > 0 && (
          <div className="mb-5">
            <p className="px-3 pb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/60">
              Recientes
            </p>
            <ul className="flex flex-col gap-0.5">
              {chats.slice(0, 8).map((chat) => (
                <li key={chat.id} className="group flex items-center gap-1">
                  <button type="button" onClick={() => handleChatSelect(chat)}
                    className={cn("flex min-h-9 flex-1 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                      activeChatId === chat.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
                    <MessageCircle className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-left text-xs">{chat.title}</span>
                  </button>
                  <button type="button" onClick={(e) => deleteChat(e, chat.id)}
                    className="hidden size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive group-hover:flex">
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Secciones del sidebar */}
        {sections.map((section) => (
          <div key={section.heading} className="mb-5">
            <p className="px-3 pb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/60">
              {section.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = active === item.id
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSelect(item.id)}
                      className={cn("group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
                      <Icon className={cn("size-[18px] shrink-0", isActive ? "text-primary" : "text-sidebar-foreground")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Voice of Gaia */}
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl bg-sidebar-accent/40 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-sidebar-accent-foreground">Voice of Gaia</span>
            <span className={cn("flex items-center gap-1.5 text-[0.65rem]", micOn ? "text-primary" : "text-sidebar-foreground/60")}>
              <span className={cn("size-1.5 rounded-full", micOn ? "bg-primary" : "bg-sidebar-foreground/40")} />
              {micOn ? "Listening" : "Idle"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onToggleMic}
              className={cn("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors",
                micOn ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground")}>
              <Mic className="size-4" />Speak
            </button>
            <button type="button" onClick={onToggleVoice}
              className={cn("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors",
                voiceOn ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground")}>
              {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {voiceOn ? "Voice" : "Muted"}
            </button>
            <button type="button" onClick={() => onSelect("settings")}
              className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
                active === "settings" ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground")}>
              <Settings className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}