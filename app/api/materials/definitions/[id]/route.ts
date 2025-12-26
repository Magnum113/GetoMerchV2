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

    const { name, unit, description } = body

    if (!name || !unit) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать название и единицу измерения" },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from("material_definitions")
      .update({
        name,
        unit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("[v0] Ошибка обновления определения материала:", error)
      return NextResponse.json(
        { success: false, error: error.message || "Не удалось обновить определение материала" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Определение материала обновлено" })
  } catch (error) {
    console.error("[v0] Ошибка обновления определения материала:", error)
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

    // Проверяем, используется ли материал в рецептах
    const { data: recipeMaterials, error: checkError } = await supabase
      .from("recipe_materials")
      .select("id")
      .eq("material_definition_id", id)
      .limit(1)

    if (checkError) {
      console.error("[v0] Ошибка проверки использования материала:", checkError)
      return NextResponse.json(
        { success: false, error: "Не удалось проверить использование материала" },
        { status: 500 },
      )
    }

    if (recipeMaterials && recipeMaterials.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Нельзя удалить материал, который используется в рецептах. Сначала удалите его из всех рецептов.",
        },
        { status: 400 },
      )
    }

    // Проверяем, есть ли партии
    const { data: lots, error: lotsError } = await supabase
      .from("material_lots")
      .select("id, quantity")
      .eq("material_definition_id", id)

    if (lotsError) {
      console.error("[v0] Ошибка проверки партий:", lotsError)
      return NextResponse.json(
        { success: false, error: "Не удалось проверить партии материала" },
        { status: 500 },
      )
    }

    const totalQuantity = lots?.reduce((sum, lot) => sum + Number.parseFloat(lot.quantity || 0), 0) || 0

    if (totalQuantity > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Нельзя удалить материал, у которого есть партии на складе (${Math.round(totalQuantity)} шт). Сначала удалите или списыте все партии.`,
        },
        { status: 400 },
      )
    }

    // Удаляем определение материала (каскадно удалятся партии и движения)
    const { error } = await supabase.from("material_definitions").delete().eq("id", id)

    if (error) {
      console.error("[v0] Ошибка удаления определения материала:", error)
      return NextResponse.json(
        { success: false, error: error.message || "Не удалось удалить определение материала" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Определение материала удалено" })
  } catch (error) {
    console.error("[v0] Ошибка удаления определения материала:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

