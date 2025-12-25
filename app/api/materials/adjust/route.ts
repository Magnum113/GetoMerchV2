import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { materialId, adjustment, reason } = body

    console.log("[v0] Корректировка материала:", { materialId, adjustment, reason })

    if (!materialId || adjustment === undefined) {
      return NextResponse.json({ success: false, error: "Отсутствуют обязательные поля" }, { status: 400 })
    }

    const supabase = await createClient()

    // Получить текущий материал
    const { data: material, error: fetchError } = await supabase
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single()

    if (fetchError || !material) {
      console.error("[v0] Материал не найден:", fetchError)
      return NextResponse.json({ success: false, error: "Материал не найден" }, { status: 404 })
    }

    // Рассчитать новое количество
    const currentStock = Number(material.quantity_in_stock) || 0
    const adjustmentNum = Number(adjustment)
    const newStock = currentStock + adjustmentNum

    console.log("[v0] Текущий запас:", currentStock, "Изменение:", adjustmentNum, "Новый запас:", newStock)

    if (newStock < 0) {
      return NextResponse.json({ success: false, error: "Запас не может быть отрицательным" }, { status: 400 })
    }

    // Обновить материал
    const { error: updateError } = await supabase
      .from("materials")
      .update({
        quantity_in_stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", materialId)

    if (updateError) {
      console.error("[v0] Ошибка обновления материала:", updateError)
      throw updateError
    }

    console.log("[v0] Материал успешно обновлен")

    return NextResponse.json({
      success: true,
      newStock,
      adjustment: adjustmentNum,
    })
  } catch (error) {
    console.error("[v0] Корректировка материала не удалась:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Не удалось скорректировать материал",
      },
      { status: 500 },
    )
  }
}
