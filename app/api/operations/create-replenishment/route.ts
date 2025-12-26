import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { materials } = await request.json() // массив {material_id, quantity_needed}
    const supabase = await createClient()

    console.log("[v0] Создаю заявки на пополнение для", materials.length, "материалов")

    const requests = materials.map((m: { material_id: string; quantity_needed: number }) => ({
      material_id: m.material_id,
      quantity_needed: m.quantity_needed,
      status: "pending",
      priority: m.quantity_needed > 10 ? "high" : "normal",
      requested_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase.from("replenishment_requests").insert(requests)

    if (insertError) {
      console.error("[v0] Ошибка создания заявок:", insertError)
      return NextResponse.json({ error: "Не удалось создать заявки" }, { status: 400 })
    }

    console.log("[v0] Заявки созданы успешно")

    return NextResponse.json({
      success: true,
      message: `Создано ${materials.length} заявок на пополнение`,
    })
  } catch (error) {
    console.error("[v0] Ошибка при создании заявок:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 500 })
  }
}
