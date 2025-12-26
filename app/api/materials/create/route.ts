import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { sku, name, unit, size, material_type, color, quantity_in_stock, min_stock_level, cost_per_unit, supplier } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать название" },
        { status: 400 },
      )
    }

    // Определяем тип материала
    const materialType = material_type === "футболка" || material_type === "худи" || material_type === "укороченное худи" 
      ? "blank" 
      : "consumable"

    // Формируем название определения материала
    const definitionName = material_type && size && color
      ? `${material_type} ${color} ${size}`
      : material_type && color
      ? `${material_type} ${color}`
      : material_type || name

    // Формируем атрибуты
    const attributes = {
      size: size || null,
      material_type: material_type || null,
      color: color || null,
      original_name: name,
      original_sku: sku || null,
    }

    // Проверяем, существует ли уже такое определение
    const { data: existingDef } = await supabase
      .from("material_definitions")
      .select("id")
      .eq("name", definitionName)
      .eq("attributes->>size", size || "")
      .eq("attributes->>color", color || "")
      .eq("attributes->>material_type", material_type || "")
      .maybeSingle()

    let definitionId: string

    if (existingDef) {
      definitionId = existingDef.id
    } else {
      // Создаем новое определение материала
      const { data: definition, error: definitionError } = await supabase
        .from("material_definitions")
        .insert({
          name: definitionName,
          type: materialType,
          attributes,
          unit: unit || "шт",
        })
        .select()
        .single()

      if (definitionError || !definition) {
        console.error("[v0] Ошибка создания определения материала:", definitionError)
        return NextResponse.json(
          { success: false, error: definitionError?.message || "Не удалось создать определение материала" },
          { status: 500 },
        )
      }

      definitionId = definition.id
    }

    // Если указано количество на складе, создаем партию
    if (quantity_in_stock && Number.parseFloat(quantity_in_stock) > 0) {
      const { data: lot, error: lotError } = await supabase
        .from("material_lots")
        .insert({
          material_definition_id: definitionId,
          supplier_name: supplier || null,
          cost_per_unit: cost_per_unit || 0,
          quantity: Number.parseFloat(quantity_in_stock),
          warehouse_id: "HOME",
          received_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (lotError) {
        console.error("[v0] Ошибка создания партии материала:", lotError)
        // Определение уже создано, но партию не удалось создать
        return NextResponse.json(
          {
            success: true,
            material_definition_id: definitionId,
            warning: "Определение создано, но партия не создана: " + lotError.message,
          },
          { status: 200 },
        )
      }

      return NextResponse.json({
        success: true,
        material_definition_id: definitionId,
        material_lot_id: lot.id,
        message: "Материал и партия созданы успешно",
      })
    }

    return NextResponse.json({
      success: true,
      material_definition_id: definitionId,
      message: "Определение материала создано. Добавьте партию позже.",
    })
  } catch (error) {
    console.error("[v0] Ошибка создания материала:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}
