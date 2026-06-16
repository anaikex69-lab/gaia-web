import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("profile_categories")
      .select("key, value")
      .eq("category", "settings")
    if (error) throw error
    const settings: Record<string, string> = {}
    for (const row of data || []) settings[row.key] = row.value
    return NextResponse.json({ settings })
  } catch (err) {
    return NextResponse.json({ settings: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { settings } = await req.json()
    if (!settings || typeof settings !== "object") 
      return NextResponse.json({ error: "settings requerido" }, { status: 400 })
    const upserts = Object.entries(settings).map(([key, value]) => ({
      category: "settings",
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from("profile_categories")
      .upsert(upserts, { onConflict: "category,key" })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error guardando settings" }, { status: 500 })
  }
}