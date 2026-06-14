import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase.from("usage_totals").select("*").eq("id", 1).single()
    if (error || !data) {
      return NextResponse.json({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
      })
    }
    return NextResponse.json({
      totalInputTokens: data.total_input_tokens || 0,
      totalOutputTokens: data.total_output_tokens || 0,
      totalCost: parseFloat(data.total_cost || 0),
    })
  } catch (err) {
    return NextResponse.json({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 })
  }
}