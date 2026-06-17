import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("profile_categories")
      .select("id, category, key, value, updated_at")
      .neq("category", "settings")
      .order("category")
      .order("updated_at", { ascending: false })
    if (error) throw error
    return NextResponse.json({ memories: data })
  } catch (err) {
    return NextResponse.json({ error: "Error cargando memoria" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, value } = await req.json()
    if (!id || value === undefined) 
      return NextResponse.json({ error: "id y value requeridos" }, { status: 400 })
    const { data, error } = await supabase
      .from("profile_categories")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select().single()
    if (error) throw error
    return NextResponse.json({ memory: data })
  } catch (err) {
    return NextResponse.json({ error: "Error actualizando memoria" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    await supabase.from("profile_categories").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error borrando memoria" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { category, key, value } = await req.json()
    if (!category || !key || !value)
      return NextResponse.json({ error: "category, key y value requeridos" }, { status: 400 })
    const { data, error } = await supabase
      .from("profile_categories")
      .upsert({ category, key, value, updated_at: new Date().toISOString() }, { onConflict: "category,key" })
      .select().single()
    if (error) throw error
    return NextResponse.json({ memory: data })
  } catch (err) {
    return NextResponse.json({ error: "Error creando memoria" }, { status: 500 })
  }
}