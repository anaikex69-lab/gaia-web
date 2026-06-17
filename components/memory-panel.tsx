"use client"

import { useEffect, useState } from "react"
import { Trash2, Edit2, Check, X, Plus, ChevronDown, ChevronRight, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

type Memory = {
  id: string
  category: string
  key: string
  value: string
  updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Personal",
  finanzas: "Finanzas",
  escuela: "Escuela",
  trabajo: "Trabajo",
  pendientes: "Pendientes",
}

const CATEGORY_COLORS: Record<string, string> = {
  personal: "text-violet-400",
  finanzas: "text-green-400",
  escuela: "text-blue-400",
  trabajo: "text-orange-400",
  pendientes: "text-yellow-400",
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newEntry, setNewEntry] = useState({ category: "personal", key: "", value: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setMemories(d.memories || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Agrupar por categoría
  const grouped = memories.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, Memory[]>)

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value: editValue }),
      })
      const data = await res.json()
      if (data.memory) {
        setMemories((prev) => prev.map((m) => m.id === id ? data.memory : m))
      }
    } catch (e) { console.error(e) }
    setEditingId(null)
    setSaving(false)
  }

  async function deleteMemory(id: string) {
    await fetch(`/api/memory?id=${id}`, { method: "DELETE" })
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  async function addMemory() {
    if (!newEntry.key.trim() || !newEntry.value.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry),
      })
      const data = await res.json()
      if (data.memory) {
        setMemories((prev) => {
          const filtered = prev.filter((m) => !(m.category === data.memory.category && m.key === data.memory.key))
          return [...filtered, data.memory].sort((a, b) => a.category.localeCompare(b.category))
        })
        setNewEntry({ category: "personal", key: "", value: "" })
        setShowAdd(false)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  }

  const totalCount = memories.length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Memoria de Gaia</h2>
          <p className="text-xs text-muted-foreground">{totalCount} entradas guardadas</p>
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Plus className="size-3.5" /> Agregar
        </button>
      </div>

      {/* Formulario nuevo */}
      {showAdd && (
        <div className="flex flex-col gap-3 border-b border-border bg-card/50 p-4">
          <div className="grid grid-cols-2 gap-2">
            <select value={newEntry.category} onChange={(e) => setNewEntry((n) => ({ ...n, category: e.target.value }))}
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <input value={newEntry.key} onChange={(e) => setNewEntry((n) => ({ ...n, key: e.target.value }))}
              placeholder="Clave (ej: trabajo)"
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <input value={newEntry.value} onChange={(e) => setNewEntry((n) => ({ ...n, value: e.target.value }))}
            placeholder="Valor (ej: cocinero en restaurante)"
            className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <button type="button" onClick={addMemory} disabled={saving || !newEntry.key.trim() || !newEntry.value.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Check className="size-4" />{saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-center text-sm text-muted-foreground">Cargando memoria...</p>}

        {!loading && totalCount === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <Brain className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Gaia aún no sabe nada de ti.</p>
            <p className="text-xs text-muted-foreground/60">Empieza a chatear y ella irá aprendiendo.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([category, entries]) => {
            const isCollapsed = collapsed[category]
            const label = CATEGORY_LABELS[category] || category
            const color = CATEGORY_COLORS[category] || "text-muted-foreground"
            return (
              <div key={category}>
                <button type="button" onClick={() => toggleCollapse(category)}
                  className="flex w-full items-center gap-2 pb-2 text-left">
                  {isCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", color)}>{label}</span>
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">{entries.length}</span>
                </button>

                {!isCollapsed && (
                  <ul className="flex flex-col gap-1.5">
                    {entries.map((mem) => (
                      <li key={mem.id} className="group rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-muted-foreground">{mem.key}</p>
                            {editingId === mem.id ? (
                              <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(mem.id); if (e.key === "Escape") setEditingId(null) }}
                                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                            ) : (
                              <p className="mt-0.5 text-sm text-foreground">{mem.value}</p>
                            )}
                            <p className="mt-1 text-[0.6rem] text-muted-foreground/50">{formatDate(mem.updated_at)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {editingId === mem.id ? (
                              <>
                                <button type="button" onClick={() => saveEdit(mem.id)} disabled={saving}
                                  className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                                  <Check className="size-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingId(null)}
                                  className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
                                  <X className="size-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => { setEditingId(mem.id); setEditValue(mem.value) }}
                                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                                  <Edit2 className="size-3.5" />
                                </button>
                                <button type="button" onClick={() => deleteMemory(mem.id)}
                                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}