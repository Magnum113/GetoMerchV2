import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: definitions, error } = await supabase
      .from("material_definitions")
      .select("id, name, type, attributes, unit")
      .order("name")

    if (error) {
      console.error("[v0] Ошибка получения определений материалов:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, definitions: definitions || [] })
  } catch (error) {
    console.error("[v0] Ошибка получения определений материалов:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

