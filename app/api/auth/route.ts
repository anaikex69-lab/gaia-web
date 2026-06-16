import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

const ALLOWED_EMAIL = process.env.GAIA_EMAIL || ""
const ALLOWED_PASSWORD = process.env.GAIA_PASSWORD || ""

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    
    if (!ALLOWED_EMAIL || !ALLOWED_PASSWORD) {
      // Sin credenciales configuradas, acceso libre (modo dev)
      return NextResponse.json({ success: true, token: "dev-token" })
    }

    if (email !== ALLOWED_EMAIL || password !== ALLOWED_PASSWORD) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 })
    }

    // Token simple — en producción real usarías JWT
    const token = Buffer.from(`${email}:${Date.now()}`).toString("base64")
    return NextResponse.json({ success: true, token })
  } catch (err) {
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 })
  }
}