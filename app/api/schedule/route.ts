import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase.from("schedule").select("*").order("day_of_week").order("start_time")
    if (error) throw error
    return NextResponse.json({ schedule: data })
  } catch (err) {
    return NextResponse.json({ error: "Error cargando horario" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { subject, day_of_week, start_time, end_time, color } = await req.json()
    if (!subject || day_of_week === undefined || !start_time || !end_time)
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 })
    const { data, error } = await supabase.from("schedule")
      .insert({ subject, day_of_week, start_time, end_time, color: color || "#6366f1" })
      .select().single()
    if (error) throw error
    return NextResponse.json({ entry: data })
  } catch (err) {
    return NextResponse.json({ error: "Error creando entrada" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  try {
    await supabase.from("schedule").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error borrando entrada" }, { status: 500 })
  }
}