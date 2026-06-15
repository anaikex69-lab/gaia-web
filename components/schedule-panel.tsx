"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type ScheduleEntry = {
  id: string
  subject: string
  day_of_week: number
  start_time: string
  end_time: string
  color: string
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
]

type NewEntry = {
  subject: string
  day_of_week: number
  start_time: string
  end_time: string
  color: string
}

export function SchedulePanel() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay())
  const [form, setForm] = useState<NewEntry>({
    subject: "", day_of_week: 1, start_time: "08:00", end_time: "09:00", color: "#6366f1"
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => setSchedule(d.schedule || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function addEntry() {
    if (!form.subject.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.entry) {
        setSchedule((prev) => [...prev, data.entry].sort((a, b) =>
          a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
        ))
        setForm({ subject: "", day_of_week: form.day_of_week, start_time: "08:00", end_time: "09:00", color: "#6366f1" })
        setShowForm(false)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/schedule?id=${id}`, { method: "DELETE" })
    setSchedule((prev) => prev.filter((e) => e.id !== id))
  }

  const entriesForDay = schedule.filter((e) => e.day_of_week === activeDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-base font-semibold text-foreground">Horario</h2>
        <button type="button" onClick={() => { setShowForm(!showForm); setForm((f) => ({ ...f, day_of_week: activeDay })) }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Plus className="size-3.5" /> Agregar
        </button>
      </div>

      {/* Días de la semana */}
      <div className="flex gap-1 border-b border-border p-2">
        {DAYS_SHORT.map((day, i) => {
          const hasClasses = schedule.some((e) => e.day_of_week === i)
          return (
            <button key={i} type="button" onClick={() => setActiveDay(i)}
              className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs transition-colors",
                activeDay === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50")}>
              {day}
              {hasClasses && (
                <span className={cn("size-1.5 rounded-full", activeDay === i ? "bg-primary-foreground/60" : "bg-primary/60")} />
              )}
            </button>
          )
        })}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="flex flex-col gap-3 border-b border-border bg-card/50 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Materia</label>
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Ej: Cálculo Diferencial"
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Día</label>
              <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{ backgroundColor: c }}
                    className={cn("size-6 rounded-full transition-transform hover:scale-110", form.color === c && "ring-2 ring-offset-2 ring-foreground/30")} />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inicio</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fin</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addEntry} disabled={saving || !form.subject.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Check className="size-4" />{saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista del día */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{DAYS[activeDay]}</p>

        {loading && <p className="text-center text-sm text-muted-foreground">Cargando...</p>}

        {!loading && entriesForDay.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground">Sin clases este día</p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {entriesForDay.map((entry) => (
            <li key={entry.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.subject}</p>
                <p className="text-xs text-muted-foreground">{entry.start_time} – {entry.end_time}</p>
              </div>
              <button type="button" onClick={() => deleteEntry(entry.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}