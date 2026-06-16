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

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const WORK_DAYS = [1, 2, 3, 4, 5] // Lun-Vie por defecto
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am - 8pm

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
]

export function CalendarPanel() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showWeekend, setShowWeekend] = useState(false)
  const [form, setForm] = useState({
    subject: "", day_of_week: 1, start_time: "08:00", end_time: "09:00", color: "#6366f1"
  })
  const [saving, setSaving] = useState(false)

  const visibleDays = showWeekend ? [0, 1, 2, 3, 4, 5, 6] : WORK_DAYS

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
        setSchedule((prev) => [...prev, data.entry])
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

  function timeToMinutes(time: string) {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
  }

  function getEntryStyle(entry: ScheduleEntry) {
    const startMin = timeToMinutes(entry.start_time) - 7 * 60
    const endMin = timeToMinutes(entry.end_time) - 7 * 60
    const totalMin = 14 * 60
    const top = (startMin / totalMin) * 100
    const height = ((endMin - startMin) / totalMin) * 100
    return { top: `${top}%`, height: `${Math.max(height, 3)}%` }
  }

  const todayDay = new Date().getDay()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-base font-semibold text-foreground">Horario semanal</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowWeekend(!showWeekend)}
            className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              showWeekend ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent/50")}>
            Fines de semana
          </button>
          <button type="button" onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Plus className="size-3.5" /> Clase
          </button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="flex flex-col gap-3 border-b border-border bg-card/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Materia" className="col-span-2 min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none">
              {DAYS_SHORT.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                  style={{ backgroundColor: c }}
                  className={cn("size-5 rounded-full", form.color === c && "ring-2 ring-offset-1 ring-foreground/30")} />
              ))}
            </div>
            <input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none" />
            <input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addEntry} disabled={saving || !form.subject.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Check className="size-4" />{saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid calendario */}
      <div className="flex min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header días */}
            <div className="sticky top-0 z-10 flex border-b border-border bg-background">
              <div className="w-10 shrink-0" />
              {visibleDays.map((day) => (
                <div key={day} className={cn("flex flex-1 items-center justify-center py-2 text-xs font-medium",
                  day === todayDay ? "text-primary" : "text-muted-foreground")}>
                  {DAYS_SHORT[day]}
                  {day === todayDay && <span className="ml-1 size-1.5 rounded-full bg-primary" />}
                </div>
              ))}
            </div>

            {/* Grid horas */}
            <div className="relative flex flex-1">
              {/* Columna horas */}
              <div className="w-10 shrink-0">
                {HOURS.map((h) => (
                  <div key={h} className="flex h-14 items-start justify-end pr-1.5 pt-0.5">
                    <span className="text-[0.6rem] text-muted-foreground/60">{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Columnas días */}
              {visibleDays.map((day) => {
                const dayEntries = schedule.filter((e) => e.day_of_week === day)
                return (
                  <div key={day} className={cn("relative flex-1 border-l border-border/50",
                    day === todayDay && "bg-primary/3")}>
                    {HOURS.map((h) => (
                      <div key={h} className="h-14 border-t border-border/30" />
                    ))}
                    {dayEntries.map((entry) => {
                      const style = getEntryStyle(entry)
                      return (
                        <div key={entry.id} className="group absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-1"
                          style={{ ...style, backgroundColor: entry.color + "30", borderLeft: `3px solid ${entry.color}` }}>
                          <p className="truncate text-[0.65rem] font-medium leading-tight" style={{ color: entry.color }}>
                            {entry.subject}
                          </p>
                          <p className="text-[0.55rem] text-muted-foreground">{entry.start_time}–{entry.end_time}</p>
                          <button type="button" onClick={() => deleteEntry(entry.id)}
                            className="absolute right-0.5 top-0.5 hidden size-4 items-center justify-center rounded text-muted-foreground hover:text-destructive group-hover:flex">
                            <X className="size-2.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}