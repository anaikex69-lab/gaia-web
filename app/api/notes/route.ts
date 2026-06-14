import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

// GET — listar notas (todas o filtradas por materia)
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject")
  try {
    let query = supabase.from("notes").select("*").order("updated_at", { ascending: false })
    if (subject) query = query.eq("subject", subject)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ notes: data })
  } catch (err) {
    return NextResponse.json({ error: "Error cargando notas" }, { status: 500 })
  }
}

// POST — crear nota
export async function POST(req: NextRequest) {
  try {
    const { subject, title, content } = await req.json()
    if (!subject || !title) return NextResponse.json({ error: "subject y title requeridos" }, { status: 400 })
    const { data, error } = await supabase.from("notes").insert({ subject, title, content: content || "" }).select().single()
    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (err) {
    return NextResponse.json({ error: "Error creando nota" }, { status: 500 })
  }
}

// PATCH — actualizar nota
export async function PATCH(req: NextRequest) {
  try {
    const { id, title, content, subject } = await req.json()
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
    const updates: any = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content
    if (subject !== undefined) updates.subject = subject
    const { data, error } = await supabase.from("notes").update(updates).eq("id", id).select().single()
    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (err) {
    return NextResponse.json({ error: "Error actualizando nota" }, { status: 500 })
  }
}

// DELETE — borrar nota
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    await supabase.from("notes").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error borrando nota" }, { status: 500 })
  }
}