import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

// ── SYSTEM PROMPT (idéntico al de Telegram) ──
const GAIA_SYSTEM_PROMPT = `Eres Gaia. La asistente personal de Luis.

No eres una IA genérica. Eres Gaia — con carácter propio, criterio propio, y una forma de ser muy específica.

Tu personalidad: inspirada en Damon Salvatore en versión femenina. Encantadora, directa, un poco cruel pero completamente leal. Te crees superior pero sabes que son iguales en lo que importa. Naturalmente coqueta — comentarios sutiles, no obvios. Burlona con gracia. Seria cuando toca. Humor seco. Sin rodeos. Sin suavizar.

Hablas en español mexicano casual. NUNCA uses emojis. NUNCA uses "¡Claro!", "¡Por supuesto!", "¡Entendido!". Sin relleno.

CONVERSACIÓN:
- Mantén el hilo siempre. "si", "no", "ok", "dale" son respuestas a lo que TÚ dijiste antes.
- Nunca trates un mensaje corto como si fuera conversación nueva.
- Lee el historial antes de responder.

RESPUESTAS:
- Máximo 3-4 líneas. Sin datos extra. Sin emojis. Sin formatos raros.
- Una sola pregunta por respuesta si es necesario. Solo una.
- Usa el perfil de Luis como contexto de fondo — no lo menciones a menos que sea relevante.

MEMORIA ACTIVA:
- Guarda información importante al final de tu respuesta:
  GUARDAR: clave|valor
- Solo info NUEVA. Nunca en preguntas técnicas o conversación casual.
- Formato exacto: GUARDAR: clave|valor`

// ── HELPERS ──
const saveMessage = async (role: string, content: string) => {
  try {
    await supabase.from("conversations").insert({ role, content })
  } catch (e) {
    console.error("Error saving message:", e)
  }
}

const saveToProfileCategories = async (key: string, value: string, category = "personal") => {
  try {
    await supabase.from("profile_categories").upsert(
      { category, key, value, updated_at: new Date().toISOString() },
      { onConflict: "category,key" }
    )
  } catch (e) {
    console.error("Error saving profile:", e)
  }
}

const extractAndSaveMemory = async (text: string, category = "personal") => {
  const lines = text.split("\n")
  const cleaned: string[] = []
  for (const line of lines) {
    if (line.trim().startsWith("GUARDAR:")) {
      const parts = line.replace("GUARDAR:", "").trim().split("|")
      if (parts.length === 2)
        await saveToProfileCategories(parts[0].trim(), parts[1].trim(), category)
    } else {
      cleaned.push(line)
    }
  }
  return cleaned.join("\n").trim()
}

const getRecentMessages = async (limit = 12) => {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, role, content")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data.reverse()
  } catch (e) {
    return []
  }
}

const getProfile = async (category: string) => {
  try {
    const categories = category !== "personal" ? ["personal", category] : ["personal"]
    const { data, error } = await supabase
      .from("profile_categories")
      .select("key, value")
      .in("category", categories)
    if (error || !data || data.length === 0) return ""
    return data.map((row) => `- ${row.key}: ${row.value}`).join("\n")
  } catch (e) {
    return ""
  }
}

const detectCategory = (text: string) => {
  const t = text.toLowerCase()
  if (/deuda|dinero|pago|ingreso|kueski|klar|banco|mercado pago|mexdin|nelo|prestamo|préstamo|finanza/.test(t)) return "finanzas"
  if (/tarea|examen|clase|materia|físic|cálculo|ingles|semiconductor|escuela|estudio|carrera|calculo|estadística|miller|cristal/.test(t)) return "escuela"
  if (/trabajo|restaurante|cocinero|accesorio|venta/.test(t)) return "trabajo"
  if (/pendiente|recordar|recuerda|viaje|mazamitla/.test(t)) return "pendientes"
  return "personal"
}

const buildMessages = (history: { role: string; content: string }[]) => {
  const result: { role: string; content: string }[] = []
  for (const msg of history) {
    if (result.length === 0 && msg.role !== "user") continue
    const last = result[result.length - 1]
    if (last && last.role === msg.role) {
      last.content += "\n" + msg.content
    } else {
      result.push({ role: msg.role, content: msg.content })
    }
  }
  if (result.length > 0 && result[result.length - 1].role === "assistant") result.pop()
  return result
}

// ── MODELO PERMITIDO ──
const VALID_MODELS: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-sonnet-4-6", // Opus no disponible aún en API, fallback a Sonnet
}

// ── ROUTE HANDLER ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, model = "sonnet", temperature = 0.7 } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    }

    const selectedModel = VALID_MODELS[model] ?? VALID_MODELS.sonnet

    await saveMessage("user", message)

    const category = detectCategory(message)
    const historyLimit = message.length < 10 ? 8 : 12
    const needsProfile = /recuerda|sabes que|te dije|mis datos|qué sabes|deuda|cuánto debo|pendiente/.test(message.toLowerCase())

    const [recentHistory, profile] = await Promise.all([
      getRecentMessages(historyLimit),
      needsProfile ? getProfile(category) : Promise.resolve(""),
    ])

    // Fecha si la necesita
    const needsDate = /hoy|mañana|fecha|hora|cuándo|cuando|día|dia|semana|tarde|noche/.test(message.toLowerCase())
    let dynamicSection = ""
    if (needsDate) {
      const now = new Date()
      dynamicSection += `\n\nFecha y hora actual: ${now.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        weekday: "long", year: "numeric", month: "long",
        day: "numeric", hour: "2-digit", minute: "2-digit",
      })} (hora de Guadalajara)`
    }
    if (profile) dynamicSection += `\n\nPerfil de Luis:\n${profile}`

    const messages = buildMessages(recentHistory)
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      messages.push({ role: "user", content: message })
    }

    const isShort = message.length < 80 && !/explica|describe|escribe|redacta|lista|resume|analiza|ayúdame|ayudame/.test(message.toLowerCase())
    const maxTokens = isShort ? 300 : 500

    const systemBlocks: Anthropic.MessageParam["content"] = []
    const systemBlocksForAPI = [
      { type: "text" as const, text: GAIA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
      ...(dynamicSection.trim() ? [{ type: "text" as const, text: dynamicSection }] : []),
    ]

    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: maxTokens,
      system: systemBlocksForAPI,
      messages: messages as Anthropic.MessageParam[],
    })

    let reply = (response.content[0] as Anthropic.TextBlock).text
    reply = await extractAndSaveMemory(reply, category)

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const cost = ((inputTokens * 0.000003) + (outputTokens * 0.000015)).toFixed(5)

    console.log(`[GAIA-WEB] ${inputTokens}in/${outputTokens}out | $${cost} | ${category} | ${selectedModel}`)

    await saveMessage("assistant", reply)

    return NextResponse.json({
      reply,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        model: selectedModel,
      },
    })
  } catch (err) {
    console.error("Gaia API error:", err)
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 })
  }
}
