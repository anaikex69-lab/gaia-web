"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, ChevronLeft, Edit2, Check, X, BookOpen, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

type Note = {
  id: string
  subject: string
  title: string
  content: string
  updated_at: string
}

type View = "subjects" | "notes" | "editor"

export function NotesPanel() {
  const [view, setView] = useState<View>("subjects")
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)

  // Estado para editar nombre de materia
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [editingSubjectValue, setEditingSubjectValue] = useState("")

  // Estado para nueva materia
  const [newSubject, setNewSubject] = useState("")
  const [showNewSubject, setShowNewSubject] = useState(false)

  // Editor
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notes")
      const data = await res.json()
      const allNotes: Note[] = data.notes || []
      setNotes(allNotes)
      const uniqueSubjects = [...new Set(allNotes.map((n) => n.subject))]
      setSubjects(uniqueSubjects)
    } catch (e) {
      console.error("Error loading notes:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const notesForSubject = notes.filter((n) => n.subject === activeSubject)

  async function createNote() {
    if (!activeSubject) return
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: activeSubject, title: "Nueva nota", content: "" }),
      })
      const data = await res.json()
      if (data.note) {
        setNotes((prev) => [data.note, ...prev])
        openEditor(data.note)
      }
    } catch (e) { console.error(e) }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNote?.id === id) { setActiveNote(null); setView("notes") }
  }

  async function saveNote() {
    if (!activeNote) return
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeNote.id, title: editTitle, content: editContent }),
      })
      const data = await res.json()
      if (data.note) {
        setNotes((prev) => prev.map((n) => n.id === data.note.id ? data.note : n))
        setActiveNote(data.note)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function renameSubject(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) { setEditingSubject(null); return }
    // Actualizar todas las notas de esa materia
    const notesToUpdate = notes.filter((n) => n.subject === oldName)
    await Promise.all(notesToUpdate.map((n) =>
      fetch("/api/notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, subject: trimmed }) })
    ))
    setNotes((prev) => prev.map((n) => n.subject === oldName ? { ...n, subject: trimmed } : n))
    setSubjects((prev) => prev.map((s) => s === oldName ? trimmed : s))
    if (activeSubject === oldName) setActiveSubject(trimmed)
    setEditingSubject(null)
  }

  async function deleteSubject(name: string) {
    const notesToDelete = notes.filter((n) => n.subject === name)
    await Promise.all(notesToDelete.map((n) => fetch(`/api/notes?id=${n.id}`, { method: "DELETE" })))
    setNotes((prev) => prev.filter((n) => n.subject !== name))
    setSubjects((prev) => prev.filter((s) => s !== name))
  }

  function addSubject() {
    const trimmed = newSubject.trim()
    if (!trimmed || subjects.includes(trimmed)) return
    setSubjects((prev) => [...prev, trimmed])
    setNewSubject("")
    setShowNewSubject(false)
  }

  function openEditor(note: Note) {
    setActiveNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setView("editor")
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  // ── VISTA: MATERIAS ──
  if (view === "subjects") {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Materias</h2>
          <button type="button" onClick={() => setShowNewSubject(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Plus className="size-3.5" /> Nueva materia
          </button>
        </div>

        {showNewSubject && (
          <div className="flex items-center gap-2">
            <input autoFocus value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSubject(); if (e.key === "Escape") setShowNewSubject(false) }}
              placeholder="Nombre de la materia..."
              className="min-h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" onClick={addSubject} className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Check className="size-4" />
            </button>
            <button type="button" onClick={() => setShowNewSubject(false)} className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}

        {loading && <p className="text-center text-sm text-muted-foreground">Cargando...</p>}

        {!loading && subjects.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <BookOpen className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay materias todavía.</p>
            <p className="text-xs text-muted-foreground/60">Crea una para empezar a tomar notas.</p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {subjects.map((subject) => {
            const count = notes.filter((n) => n.subject === subject).length
            return (
              <li key={subject} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                {editingSubject === subject ? (
                  <input autoFocus value={editingSubjectValue} onChange={(e) => setEditingSubjectValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameSubject(subject, editingSubjectValue); if (e.key === "Escape") setEditingSubject(null) }}
                    onBlur={() => renameSubject(subject, editingSubjectValue)}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                ) : (
                  <button type="button" onClick={() => { setActiveSubject(subject); setView("notes") }}
                    className="flex flex-1 items-center gap-3 text-left">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{subject}</p>
                      <p className="text-xs text-muted-foreground">{count} nota{count !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditingSubject(subject); setEditingSubjectValue(subject) }}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Edit2 className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteSubject(subject)}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ── VISTA: NOTAS DE UNA MATERIA ──
  if (view === "notes") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <button type="button" onClick={() => setView("subjects")}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="flex-1 truncate text-base font-semibold text-foreground">{activeSubject}</h2>
          <button type="button" onClick={createNote}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Plus className="size-3.5" /> Nueva nota
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {notesForSubject.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Sin notas en esta materia.</p>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {notesForSubject.map((note) => (
              <li key={note.id} className="group flex items-center gap-2">
                <button type="button" onClick={() => openEditor(note)}
                  className="flex min-h-14 flex-1 flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30">
                  <span className="text-sm font-medium text-foreground">{note.title}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {note.content || "Sin contenido"} · {formatDate(note.updated_at)}
                  </span>
                </button>
                <button type="button" onClick={() => deleteNote(note.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // ── VISTA: EDITOR ──
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button type="button" onClick={() => { saveNote(); setView("notes") }}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
          <ChevronLeft className="size-5" />
        </button>
        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Título de la nota..."
          className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none" />
        <button type="button" onClick={saveNote} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Check className="size-3.5" />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
        placeholder="Escribe tus apuntes aquí..."
        className="flex-1 resize-none bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
    </div>
  )
}