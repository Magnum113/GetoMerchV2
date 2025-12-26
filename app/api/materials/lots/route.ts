import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { material_definition_id, supplier_name, cost_per_unit, quantity, warehouse_id = "HOME" } = body

    if (!material_definition_id || !quantity || Number.parseFloat(quantity) <= 0) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать определение материала и количество" },
        { status: 400 },
      )
    }

    // Создаем новую партию
    const { data: lot, error: lotError } = await supabase
      .from("material_lots")
      .insert({
        material_definition_id,
        supplier_name: supplier_name || null,
        cost_per_unit: cost_per_unit || 0,
        quantity: Number.parseFloat(quantity),
        warehouse_id,
        received_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        material_definitions(id, name, unit, attributes)
      `,
      )
      .single()

    if (lotError || !lot) {
      console.error("[v0] Ошибка создания партии:", lotError)
      return NextResponse.json(
        { success: false, error: lotError?.message || "Не удалось создать партию" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, lot })
  } catch (error) {
    console.error("[v0] Ошибка создания партии:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const definitionId = searchParams.get("definition_id")

    let query = supabase
      .from("material_lots")
      .select(
        `
        *,
        material_definitions(id, name, unit, attributes)
      `,
      )
      .order("received_at", { ascending: true }) // FIFO порядок

    if (definitionId) {
      query = query.eq("material_definition_id", definitionId)
    }

    const { data: lots, error } = await query

    if (error) {
      console.error("[v0] Ошибка получения партий:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lots: lots || [] })
  } catch (error) {
    console.error("[v0] Ошибка получения партий:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}
