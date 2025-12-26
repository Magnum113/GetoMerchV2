import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { materialService } from "@/lib/services/material-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productionId, productId, quantity } = body

    if (!productionId || !productId || !quantity) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Получаем детали использованных материалов
    const materialDetails = await materialService.getProductionMaterialDetails(productionId)
    const totalCost = materialDetails.reduce((sum, m) => sum + m.total_cost, 0)

    // Обновляем статус производства
    const { error: updateError } = await supabase
      .from("production_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
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

    // Обновляем инвентарь - добавляем произведенные товары на склад
    const { data: inventory } = await supabase.from("inventory").select("*").eq("product_id", productId).single()

    if (inventory) {
      await supabase
        .from("inventory")
        .update({
          quantity_in_stock: inventory.quantity_in_stock + quantity,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", inventory.id)
    } else {
      // Создаем запись инвентаря, если её нет
      await supabase.from("inventory").insert({
        product_id: productId,
        warehouse_location: "HOME",
        quantity_in_stock: quantity,
        quantity_reserved: 0,
        min_stock_level: 15,
        last_updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      materialDetails,
      totalCost,
      message: "Производство завершено. Товары добавлены на склад.",
    })
  } catch (error) {
    console.error("[v0] Ошибка завершения производства:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete production",
      },
      { status: 500 },
    )
  }
}
