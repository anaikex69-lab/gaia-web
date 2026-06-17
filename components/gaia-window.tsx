"use client"

import type { LucideIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Minus, X, Calendar, NotebookPen, ListTodo, Mail,
  GitCompareArrows, BookOpen, Telescope, Images, Brain,
  Sparkle, Library, Search, Palette, Settings, BarChart3,
  ArrowDownToLine, ArrowUpFromLine, Sigma, DollarSign, Eye, EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGaia } from "@/lib/gaia-context"
import { NotesPanel } from "@/components/notes-panel"
import { SchedulePanel } from "@/components/schedule-panel"
import { CalendarPanel } from "@/components/calendar-panel"
import { TasksPanel } from "@/components/tasks-panel"
import { MemoryPanel } from "@/components/memory-panel"

export type WindowMeta = { id: string; label: string; icon: LucideIcon }

export const WINDOW_REGISTRY: Record<string, WindowMeta> = {
  calendar: { id: "calendar", label: "Calendar", icon: Calendar },
  notes: { id: "notes", label: "Notes", icon: NotebookPen },
  tasks: { id: "tasks", label: "Tasks", icon: ListTodo },
  email: { id: "email", label: "Email", icon: Mail },
  compare: { id: "compare", label: "Compare", icon: GitCompareArrows },
  cookbook: { id: "cookbook", label: "Cookbook", icon: BookOpen },
  "deep-research": { id: "deep-research", label: "Deep Research", icon: Telescope },
  gallery: { id: "gallery", label: "Gallery", icon: Images },
  brain: { id: "brain", label: "Brain", icon: Brain },
  memory: { id: "memory", label: "Memory", icon: Sparkle },
  library: { id: "library", label: "Library", icon: Library },
  search: { id: "search", label: "Search", icon: Search },
  theme: { id: "theme", label: "Theme", icon: Palette },
  settings: { id: "settings", label: "Configuración", icon: Settings },
  usage: { id: "usage", label: "Uso", icon: BarChart3 },
}

export type WindowState = { id: string; minimized: boolean; x: number; y: number; z: number }

type GaiaWindowProps = {
  state: WindowState
  meta: WindowMeta
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onFocus: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}

export function GaiaWindow({ state, meta, onClose, onMinimize, onFocus, onMove }: GaiaWindowProps) {
  const Icon = meta.icon
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    onFocus(state.id)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: state.x, originY: state.y }
  }, [onFocus, state.id, state.x, state.y])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    onMove(state.id, Math.max(0, d.originX + (e.clientX - d.startX)), Math.max(0, d.originY + (e.clientY - d.startY)))
  }, [onMove, state.id])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  if (state.minimized) return null

  return (
    <div
      role="dialog"
      aria-label={meta.label}
      onMouseDown={() => onFocus(state.id)}
      style={{ left: state.x, top: state.y, zIndex: state.z }}
      className="absolute flex max-h-[82%] w-[min(92vw,32rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-border bg-secondary/60 px-3 py-2.5 active:cursor-grabbing"
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 truncate text-sm font-medium text-foreground">{meta.label}</span>
        <button type="button" onClick={() => onMinimize(state.id)} aria-label={`Minimize ${meta.label}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onClose(state.id)} aria-label={`Close ${meta.label}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.id === "usage" ? <UsageContent /> 
          : state.id === "notes" ? <NotesContent /> 
          : state.id === "calendar" ? <CalendarContent />
          : state.id === "tasks" ? <TasksContent />
          : state.id === "memory" ? <MemoryContent />
          : <SettingsContent />}
      </div>
    </div>
  )
}

// ── HELPERS ──
function formatNumber(n: number) {
  return new Intl.NumberFormat("es-MX").format(n)
}
function formatUsd(n: number) {
  return `$${n.toFixed(n < 1 ? 5 : 2)} USD`
}

type UsageStat = { label: string; value: string; icon: LucideIcon; accent?: boolean }
function StatCard({ label, value, icon: Icon, accent }: UsageStat) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border p-4", accent ? "border-primary/30 bg-primary/10" : "border-border bg-secondary/40")}>
      <span className="flex items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("size-3.5", accent ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums leading-none", accent ? "text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  )
}

// ── USAGE CONTENT (datos reales del contexto) ──
function NotesContent() { return <NotesPanel /> }
function ScheduleContent() { return <SchedulePanel /> }
function CalendarContent() { return <CalendarPanel /> }
function TasksContent() { return <TasksPanel /> }
function MemoryContent() { return <MemoryPanel /> }

function UsageContent() {
  const { sessionUsage, totalUsage, setTotalUsage } = useGaia()
  const sessionTokens = sessionUsage.input + sessionUsage.output
  const totalTokens = totalUsage.input + totalUsage.output

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => setTotalUsage({ input: d.totalInputTokens, output: d.totalOutputTokens, cost: d.totalCost }))
      .catch(console.error)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Sesión actual</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            En vivo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tokens entrada" value={formatNumber(sessionUsage.input)} icon={ArrowDownToLine} />
          <StatCard label="Tokens salida" value={formatNumber(sessionUsage.output)} icon={ArrowUpFromLine} />
          <StatCard label="Tokens totales" value={formatNumber(sessionTokens)} icon={Sigma} />
          <StatCard label="Costo estimado" value={formatUsd(sessionUsage.cost)} icon={DollarSign} accent />
        </div>
        {sessionUsage.messages === 0 && (
          <p className="text-center text-xs text-muted-foreground">Empieza a chatear para ver las estadísticas.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Total acumulado</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tokens entrada" value={formatNumber(totalUsage.input)} icon={ArrowDownToLine} />
          <StatCard label="Tokens salida" value={formatNumber(totalUsage.output)} icon={ArrowUpFromLine} />
          <StatCard label="Tokens totales" value={formatNumber(totalTokens)} icon={Sigma} />
          <StatCard label="Costo total" value={formatUsd(totalUsage.cost)} icon={DollarSign} accent />
        </div>
        <p className="text-[0.65rem] text-muted-foreground">Suma de todas las conversaciones desde la web, persistente.</p>
      </section>

      <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
        Los costos son una estimación. Precio: Haiku $0.80/$4.00 · Sonnet $3.00/$15.00 por millón de tokens.
      </p>
    </div>
  )
}

// ── SETTINGS CONTENT (conectado al contexto global) ──
const MODELS = [
  { id: "haiku", name: "Claude Haiku", hint: "Rápido y económico" },
  { id: "sonnet", name: "Claude Sonnet", hint: "Equilibrado · recomendado" },
  { id: "opus", name: "Claude Opus", hint: "Máxima capacidad" },
  { id: "fable", name: "Claude Fable 5", hint: "Frontier · más poderoso" },
  { id: "llama", name: "Llama 3.1 70B", hint: "Groq · gratis · rápido" },
  { id: "llama_fast", name: "Llama 3.1 8B", hint: "Groq · gratis · ultrarrápido" },
]
const RESPONSE_MODES = [
  { id: "casual", label: "Casual" },
  { id: "analysis", label: "Análisis" },
  { id: "code", label: "Código" },
  { id: "creative", label: "Creativo" },
]
const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "pt", label: "Português" },
]

function SettingsContent() {
  const { settings, updateSettings } = useGaia()
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState("")

  return (
    <div className="flex flex-col gap-5">
      {/* Model */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modelo</legend>
        {MODELS.map((m) => {
          const isActive = settings.model === m.id
          return (
            <button key={m.id} type="button" onClick={() => updateSettings({ model: m.id as any })} aria-pressed={isActive}
              className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", isActive ? "border-primary bg-accent" : "border-border hover:bg-accent/50")}>
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", isActive ? "border-primary" : "border-border")}>
                {isActive && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{m.name}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </button>
          )
        })}
      </fieldset>

      {/* Temperature */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="temperature" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Temperatura</label>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">{settings.temperature.toFixed(2)}</span>
        </div>
        <input id="temperature" type="range" min={0} max={1} step={0.01} value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary" />
        <div className="flex justify-between text-[0.65rem] text-muted-foreground">
          <span>Preciso</span><span>Creativo</span>
        </div>
      </div>

      {/* Response mode */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modo de respuesta</span>
        <div className="grid grid-cols-2 gap-2">
          {RESPONSE_MODES.map((r) => {
            const isActive = settings.mode === r.id
            return (
              <button key={r.id} type="button" onClick={() => updateSettings({ mode: r.id as any })} aria-pressed={isActive}
                className={cn("min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors",
                  isActive ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent/50")}>
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-2">
        <label htmlFor="language" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Idioma por defecto</label>
        <select id="language" value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>

      {/* Assistant name */}
      <div className="flex flex-col gap-2">
        <label htmlFor="assistant-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre del asistente</label>
        <input id="assistant-name" value={settings.assistantName} onChange={(e) => updateSettings({ assistantName: e.target.value })}
          placeholder="Gaia"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
      </div>

      {/* API key */}
      <div className="flex flex-col gap-2">
        <label htmlFor="api-key" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API key de Anthropic</label>
        <div className="relative">
          <input id="api-key" type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..." autoComplete="off" spellCheck={false}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
          <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Ocultar" : "Mostrar"}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {showKey ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="text-[0.7rem] leading-relaxed text-muted-foreground">Tu clave se mantiene segura en el servidor.</p>
      </div>
    </div>
  )
}

// ── COMING SOON OVERLAY ──
type ComingSoonOverlayProps = { id: string; onClose: () => void }
export function ComingSoonOverlay({ id, onClose }: ComingSoonOverlayProps) {
  const meta = WINDOW_REGISTRY[id]
  const Icon = meta?.icon ?? Sparkle

  return (
    <div className="absolute inset-0 z-[95] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} aria-label="Cerrar"
        className="absolute inset-0 bg-background/40 backdrop-blur-md" />
      <div role="dialog" aria-label={`${meta?.label} — En desarrollo`}
        className="relative flex w-[min(92vw,24rem)] flex-col items-center gap-4 rounded-3xl border border-border bg-card/60 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <button type="button" onClick={onClose} aria-label="Cerrar"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
        <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-primary/10 text-3xl">🚧</span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Icon className="size-4 text-primary" aria-hidden="true" />
            {meta?.label}
          </span>
          <h2 className="text-lg font-semibold text-foreground">Próximamente</h2>
          <p className="max-w-[16rem] text-balance text-sm leading-relaxed text-muted-foreground">
            Estamos construyendo esta sección. Vuelve pronto para probarla.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          En desarrollo
        </span>
      </div>
    </div>
  )
}