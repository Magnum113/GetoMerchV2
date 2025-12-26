import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { materialService } from "@/lib/services/material-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productionId } = body

    if (!productionId) {
      return NextResponse.json({ success: false, error: "Production ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Получаем задачу производства
    const { data: production, error: productionError } = await supabase
      .from("production_queue")
      .select(
        `
        *,
        products(id),
        recipes!inner(
          id,
          recipe_materials(
            material_definition_id,
            quantity_required,
            material_definitions(id, name)
          )
        )
      `,
      )
      .eq("id", productionId)
      .single()

    if (productionError || !production) {
      return NextResponse.json({ success: false, error: "Production task not found" }, { status: 404 })
    }

    // Проверяем и резервируем материалы
    const reservation = await materialService.reserveMaterialsForProduction(
      production.recipes.id,
      production.quantity,
    )

    if (!reservation.success) {
      const missingList = reservation.missingMaterials
        .map((m) => `${m.name}: нужно ${m.required}, доступно ${m.available}`)
        .join("\n")

      return NextResponse.json(
        {
          success: false,
          error: "Недостаточно материалов для производства",
          missingMaterials: reservation.missingMaterials,
          details: missingList,
        },
        { status: 400 },
      )
    }

    // Списываем материалы (создаем движения)
    const consumeResult = await materialService.consumeMaterials(
      reservation.reservations,
      productionId,
      "production",
    )

    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, error: consumeResult.error || "Не удалось списать материалы" },
        { status: 500 },
      )
    }

    // Обновляем статус производства
    const { error: updateError } = await supabase
      .from("production_queue")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productionId)

    if (updateError) {
      console.error("[v0] Ошибка обновления статуса производства:", updateError)
      return NextResponse.json(
        { success: false, error: "Не удалось обновить статус производства" },
        { status: 500 },
      )
    }

    // Рассчитываем себестоимость
    const productionCost = materialService.calculateProductionCost(reservation.reservations)

    return NextResponse.json({
      success: true,
      message: "Производство запущено. Материалы списаны автоматически по FIFO.",
      productionCost,
      reservations: reservation.reservations,
    })
  } catch (error) {
    console.error("[v0] Ошибка запуска производства:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
