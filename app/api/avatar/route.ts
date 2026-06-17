import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ error: "Solo imágenes" }, { status: 400 })
    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "Máximo 5MB" }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name.split(".").pop() || "jpg"
    const fileName = `gaia-avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("gaia-assets")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from("gaia-assets").getPublicUrl(fileName)

    // Guardar URL en profile_categories
    await supabase.from("profile_categories").upsert(
      { category: "settings", key: "avatarUrl", value: data.publicUrl, updated_at: new Date().toISOString() },
      { onConflict: "category,key" }
    )

    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    console.error("Avatar upload error:", err)
    return NextResponse.json({ error: "Error subiendo imagen" }, { status: 500 })
  }
}