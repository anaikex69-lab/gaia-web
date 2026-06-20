import { NextRequest, NextResponse } from "next/server"

const VOICE_ID = "pFZP5JQG7iQjIQuC4Bku" // Voz premade femenina (acento británico, pero funciona en multilingüe)

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Texto faltante" }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs no configurado" }, { status: 500 })
    }

    // Limitar longitud para no gastar de más en respuestas largas
    const trimmedText = text.slice(0, 1200)

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error("ElevenLabs error:", errText)
      return NextResponse.json({ error: "Error generando audio" }, { status: 502 })
    }

    const audioBuffer = await res.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("Error en /api/voice:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}