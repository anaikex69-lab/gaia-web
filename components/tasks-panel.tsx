"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Task = {
  id: string
  title: string
  completed: boolean
  category: string
  created_at: string
}

const CATEGORIES = [
  { id: "personal", label: "Personal", color: "bg-violet-500/20 text-violet-400" },
  { id: "escuela", label: "Escuela", color: "bg-blue-500/20 text-blue-400" },
  { id: "trabajo", label: "Trabajo", color: "bg-orange-500/20 text-orange-400" },
  { id: "finanzas", label: "Finanzas", color: "bg-green-500/20 text-green-400" },
]

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState("personal")
  const [showForm, setShowForm] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function addTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory }),
      })
      const data = await res.json()
      if (data.task) {
        setTasks((prev) => [data.task, ...prev])
        setNewTitle("")
        setShowForm(false)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function toggleTask(id: string, completed: boolean) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed } : t))
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    })
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
  }

  const filtered = tasks.filter((t) => {
    if (activeFilter === "pending") return !t.completed
    if (activeFilter === "done") return t.completed
    if (activeFilter !== "all") return t.category === activeFilter
    return true
  })

  const pendingCount = tasks.filter((t) => !t.completed).length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pendientes</h2>
          {pendingCount > 0 && (
            <p className="text-xs text-muted-foreground">{pendingCount} sin completar</p>
          )}
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Plus className="size-3.5" /> Nueva
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="flex flex-col gap-3 border-b border-border bg-card/50 p-4">
          <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTask(); if (e.key === "Escape") setShowForm(false) }}
            placeholder="Nueva tarea..."
            className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <div className="flex flex-1 gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setNewCategory(c.id)}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", c.color,
                    newCategory === c.id ? "ring-2 ring-primary/50" : "opacity-60")}>
                  {c.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={addTask} disabled={saving || !newTitle.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
              <Check className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
        {[
          { id: "all", label: "Todas" },
          { id: "pending", label: "Pendientes" },
          { id: "done", label: "Completadas" },
          ...CATEGORIES,
        ].map((f) => (
          <button key={f.id} type="button" onClick={() => setActiveFilter(f.id)}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              activeFilter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-center text-sm text-muted-foreground">Cargando...</p>}

        {!loading && filtered.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground">Sin tareas aquí</p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {filtered.map((task) => {
            const cat = CATEGORIES.find((c) => c.id === task.category)
            return (
              <li key={task.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <button type="button" onClick={() => toggleTask(task.id, !task.completed)}
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    task.completed ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}>
                  {task.completed && <Check className="size-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", task.completed && "line-through text-muted-foreground")}>
                    {task.title}
                  </p>
                  {cat && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium", cat.color)}>
                      {cat.label}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => deleteTask(task.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}