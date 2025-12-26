import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: materials, error } = await supabase
      .from("materials")
      .select("id, name, unit, sku")
      .order("name")

    if (error) {
      console.error("[v0] Ошибка получения материалов:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, materials: materials || [] })
  } catch (error) {
    console.error("[v0] Ошибка получения материалов:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

