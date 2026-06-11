import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId")
  if (!chatId) return NextResponse.json({ error: "chatId requerido" }, { status: 400 })

  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })

    if (error) throw error
    return NextResponse.json({ messages: data })
  } catch (err) {
    return NextResponse.json({ error: "Error cargando mensajes" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId")
  if (!chatId) return NextResponse.json({ error: "chatId requerido" }, { status: 400 })

  try {
    await supabase.from("conversations").delete().eq("chat_id", chatId)
    await supabase.from("chats").delete().eq("id", chatId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Error eliminando chat" }, { status: 500 })
  }
}