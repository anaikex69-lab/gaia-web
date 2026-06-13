import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_SIZE = 20 * 1024 * 1024 // 20MB

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""

  if (["txt", "csv", "js", "py", "json", "md", "html", "css", "ts"].includes(ext)) {
    return buffer.toString("utf-8").slice(0, 8000)
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse")
      const data = await pdfParse(buffer)
      return data.text.slice(0, 6000)
    } catch (e) {
      console.error("PDF error:", e)
      return "No se pudo leer el PDF."
    }
  }

  if (["xlsx", "xls"].includes(ext)) {
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(buffer, { type: "buffer" })
      let result = ""
      workbook.SheetNames.forEach((name) => {
        result += `[Hoja: ${name}]\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}\n\n`
      })
      return result.slice(0, 8000)
    } catch (e) {
      console.error("Excel error:", e)
      return "No se pudo leer el Excel."
    }
  }

  if (["docx", "doc"].includes(ext)) {
    try {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer })
      return result.value.slice(0, 8000)
    } catch (e) {
      console.error("Word error:", e)
      return "No se pudo leer el Word."
    }
  }

  return `Archivo: ${fileName}. Tipo no soportado.`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Archivo muy grande. Máximo 20MB." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Imágenes: devolver base64 para mandar directo a Claude como imagen
    if (file.type.startsWith("image/")) {
      const base64 = buffer.toString("base64")
      return NextResponse.json({
        fileName: file.name,
        fileType: file.type,
        isImage: true,
        imageBase64: base64,
        imageMediaType: file.type,
      })
    }

    const extractedText = await extractText(buffer, file.type, file.name)

    return NextResponse.json({
      fileName: file.name,
      fileType: file.type,
      isImage: false,
      extractedText,
    })
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json({ error: "Error procesando el archivo" }, { status: 500 })
  }
}