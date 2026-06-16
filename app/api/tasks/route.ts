import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return NextResponse.json({ tasks: data })
  } catch (err) {
    return NextResponse.json({ error: "Error cargando tasks" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, category } = await req.json()
    if (!title) return NextResponse.json({ error: "title requerido" }, { status: 400 })
    const { data, error } = await supabase.from("tasks")
      .insert({ title, category: category || "personal", completed: false })
      .select().single()
    if (error) throw error
    return NextResponse.json({ task: data })
  } catch (err) {
    return NextResponse.json({ error: "Error creando task" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, completed, title } = await req.json()
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
    const updates: any = {}
    if (completed !== undefined) updates.completed = completed
    if (title !== undefined) updates.title = title
    const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single()
    if (error) throw error
    return NextResponse.json({ task: data })
  } catch (err) {
    return NextResponse.json({ error: "Error actualizando task" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    await supabase.from("tasks").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error borrando task" }, { status: 500 })
  }
}