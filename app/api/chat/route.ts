import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY })
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

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
- Formato exacto: GUARDAR: clave|valor

NOTAS:
- Si Luis pide crear/guardar una nota, al final de tu respuesta escribe:
  NOTA: materia|título|contenido
- materia puede ser "General" si no especifica.
- Solo cuando explícitamente pida guardar algo como nota.
- Formato exacto: NOTA: materia|título|contenido`

const saveMessage = async (role: string, content: string, chatId: string) => {
  try {
    await supabase.from("conversations").insert({ role, content, chat_id: chatId })
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
    } else if (line.trim().startsWith("NOTA:")) {
      const parts = line.replace("NOTA:", "").trim().split("|")
      if (parts.length === 3) {
        try {
          await supabase.from("notes").insert({
            subject: parts[0].trim(),
            title: parts[1].trim(),
            content: parts[2].trim(),
          })
        } catch (e) { console.error("Error saving note:", e) }
      }
    } else {
      cleaned.push(line)
    }
  }
  return cleaned.join("\n").trim()
}

const getRecentMessages = async (chatId: string, limit = 12) => {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, role, content")
      .eq("chat_id", chatId)
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

const VALID_MODELS: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-sonnet-4-6",
  fable: "claude-fable-5-20260609",
}

// Genera título automático para el chat basado en el primer mensaje
const generateChatTitle = async (message: string): Promise<string> => {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      messages: [{
        role: "user",
        content: `Resume este mensaje en máximo 4 palabras para usar como título de conversación. Solo el título, sin puntos ni comillas: "${message.slice(0, 200)}"`
      }]
    })
    return (res.content[0] as Anthropic.TextBlock).text.trim().slice(0, 50)
  } catch {
    return message.slice(0, 40)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, model = "sonnet", temperature = 0.7, chatId, isFirstMessage, fileContext, imageBase64, imageMediaType } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    }

    if (!chatId) {
      return NextResponse.json({ error: "chat_id requerido" }, { status: 400 })
    }

    const selectedModel = VALID_MODELS[model] ?? VALID_MODELS.sonnet

    await saveMessage("user", message, chatId)

    const category = detectCategory(message)
    const historyLimit = message.length < 10 ? 8 : 12
    const needsProfile = /recuerda|sabes que|te dije|mis datos|qué sabes|deuda|cuánto debo|pendiente/.test(message.toLowerCase())

    const [recentHistory, profile] = await Promise.all([
      getRecentMessages(chatId, historyLimit),
      needsProfile ? getProfile(category) : Promise.resolve(""),
    ])

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

    // Leer notas si las menciona
    const needsNotes = /nota|apunte|escribí|guardé|tengo en notas|mis notas|materia|apuntes/.test(message.toLowerCase())
    if (needsNotes) {
      try {
        const { data: notesData } = await supabase
          .from("notes")
          .select("subject, title, content, updated_at")
          .order("updated_at", { ascending: false })
          .limit(20)
        if (notesData && notesData.length > 0) {
          const notesText = notesData.map((n) =>
            `[${n.subject}] ${n.title}: ${n.content?.slice(0, 300) || "(vacío)"}`
          ).join("\n")
          dynamicSection += `\n\nNotas de Luis:\n${notesText}`
        }
      } catch (e) { console.error("Error fetching notes:", e) }
    }

    // Detectar si Gaia debe crear una nota
    const wantsNote = /guarda (esto|eso|esta nota|esa nota)|crea (una )?nota|añade (una )?nota|agrega (una )?nota/.test(message.toLowerCase())

    const messages = buildMessages(recentHistory)
    const finalUserContent = fileContext
      ? `${message}\n\n[Contenido del archivo adjunto]:\n${fileContext}`
      : message

    // Si hay imagen, construir contenido multimodal
    let userContent: any = finalUserContent
    if (imageBase64 && imageMediaType) {
      userContent = [
        { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
        { type: "text", text: finalUserContent },
      ]
    }

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      messages.push({ role: "user", content: userContent })
    } else {
      messages[messages.length - 1].content = userContent
    }

    const isShort = message.length < 80 && !/explica|describe|escribe|redacta|lista|resume|analiza|ayúdame|ayudame/.test(message.toLowerCase())
    const maxTokens = (fileContext || imageBase64) ? 700 : (isShort ? 300 : 500)

    const systemBlocksForAPI = [
      { type: "text" as const, text: GAIA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
      ...(dynamicSection.trim() ? [{ type: "text" as const, text: dynamicSection }] : []),
    ]

    // Generar título si es el primer mensaje
    let chatTitle: string | undefined
    if (isFirstMessage) {
      chatTitle = await generateChatTitle(message)
      await supabase.from("chats").update({ title: chatTitle, updated_at: new Date().toISOString() }).eq("id", chatId)
    } else {
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId)
    }

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

    // Acumular tokens totales en Supabase
    try {
      const { data: current } = await supabase.from("usage_totals").select("*").eq("id", 1).single()
      await supabase.from("usage_totals").update({
        total_input_tokens: (current?.total_input_tokens || 0) + inputTokens,
        total_output_tokens: (current?.total_output_tokens || 0) + outputTokens,
        total_cost: parseFloat(current?.total_cost || 0) + parseFloat(cost),
        updated_at: new Date().toISOString(),
      }).eq("id", 1)
    } catch (e) {
      console.error("Error updating usage totals:", e)
    }

    await saveMessage("assistant", reply, chatId)

    return NextResponse.json({
      reply,
      chatTitle,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, model: selectedModel },
    })
  } catch (err) {
    console.error("Gaia API error:", err)
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 })
  }
}

// Endpoint para crear un nuevo chat
export async function PUT(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("chats")
      .insert({ title: "Nueva conversación" })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ chat: data })
  } catch (err) {
    console.error("Error creating chat:", err)
    return NextResponse.json({ error: "No se pudo crear el chat" }, { status: 500 })
  }
}

// Endpoint para obtener lista de chats
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ chats: data })
  } catch (err) {
    console.error("Error fetching chats:", err)
    return NextResponse.json({ error: "No se pudieron cargar los chats" }, { status: 500 })
  }
}