import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    const { quantity, cost_per_unit, supplier_name } = body

    if (quantity !== undefined && Number.parseFloat(quantity) < 0) {
      return NextResponse.json(
        { success: false, error: "Количество не может быть отрицательным" },
        { status: 400 },
      )
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (quantity !== undefined) {
      updateData.quantity = Number.parseFloat(quantity)
    }

    if (cost_per_unit !== undefined) {
      updateData.cost_per_unit = Number.parseFloat(cost_per_unit)
    }

    if (supplier_name !== undefined) {
      updateData.supplier_name = supplier_name || null
    }

    const { error } = await supabase.from("material_lots").update(updateData).eq("id", id)

    if (error) {
      console.error("[v0] Ошибка обновления партии:", error)
      return NextResponse.json(
        { success: false, error: error.message || "Не удалось обновить партию" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Партия обновлена" })
  } catch (error) {
    console.error("[v0] Ошибка обновления партии:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Проверяем, есть ли движения по этой партии
    const { data: movements, error: movementsError } = await supabase
      .from("material_movements")
      .select("id")
      .eq("material_lot_id", id)
      .limit(1)

    if (movementsError) {
      console.error("[v0] Ошибка проверки движений:", movementsError)
      return NextResponse.json(
        { success: false, error: "Не удалось проверить движения по партии" },
        { status: 500 },
      )
    }

    if (movements && movements.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Нельзя удалить партию, по которой есть движения материалов. Используйте корректировку количества.",
        },
        { status: 400 },
      )
    }

    const { error } = await supabase.from("material_lots").delete().eq("id", id)

    if (error) {
      console.error("[v0] Ошибка удаления партии:", error)
      return NextResponse.json(
        { success: false, error: error.message || "Не удалось удалить партию" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Партия удалена" })
  } catch (error) {
    console.error("[v0] Ошибка удаления партии:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

