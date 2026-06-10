"use client"

import type { LucideIcon } from "lucide-react"
import {
  Plus, Search, MessagesSquare, Brain, Sparkle, Library,
  Calendar, NotebookPen, ListTodo, Mail, GitCompareArrows,
  BookOpen, Telescope, Images, Palette, Settings, Mic, Volume2, VolumeX, BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGaia } from "@/lib/gaia-context"

type NavItem = { id: string; label: string; icon: LucideIcon; badge?: string | number }
type NavSection = { heading: string; items: NavItem[] }

type GaiaSidebarProps = {
  active: string
  onSelect: (id: string) => void
  micOn: boolean
  voiceOn: boolean
  onToggleMic: () => void
  onToggleVoice: () => void
}

export function GaiaSidebar({ active, onSelect, micOn, voiceOn, onToggleMic, onToggleVoice }: GaiaSidebarProps) {
  const { chatCount, sessionUsage } = useGaia()

  const sections: NavSection[] = [
    {
      heading: "Acciones Rápidas",
      items: [{ id: "search", label: "Search", icon: Search }],
    },
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
        {
          id: "usage",
          label: "Uso",
          icon: BarChart3,
          badge: sessionUsage.messages > 0 ? `$${sessionUsage.cost.toFixed(4)}` : undefined,
        },
      ],
    },
    {
      heading: "Configuración",
      items: [{ id: "settings", label: "Configuración", icon: Settings }],
    },
  ]

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkle className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-accent-foreground">Gaia</span>
          <span className="text-xs text-sidebar-foreground">AI Workspace</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => onSelect("new-chat")}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Chat
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
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
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0",
                          isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground",
                        )}
                        aria-hidden="true"
                      />
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
              <span className={cn("size-1.5 rounded-full", micOn ? "bg-primary" : "bg-sidebar-foreground/40")} aria-hidden="true" />
              {micOn ? "Listening" : "Idle"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMic}
              aria-pressed={micOn}
              aria-label="Toggle speech to text"
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors",
                micOn ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground",
              )}
            >
              <Mic className="size-4" aria-hidden="true" />
              Speak
            </button>
            <button
              type="button"
              onClick={onToggleVoice}
              aria-pressed={voiceOn}
              aria-label="Toggle voice response"
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors",
                voiceOn ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground",
              )}
            >
              {voiceOn ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
              {voiceOn ? "Voice" : "Muted"}
            </button>
            <button
              type="button"
              onClick={() => onSelect("settings")}
              aria-pressed={active === "settings"}
              aria-label="Open settings"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
                active === "settings" ? "bg-primary text-primary-foreground" : "bg-sidebar text-sidebar-foreground hover:text-sidebar-accent-foreground",
              )}
            >
              <Settings className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
