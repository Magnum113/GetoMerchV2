import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { mapOperationalToOrderFlowStatus } from "@/lib/utils/order-status"

export async function POST(request: NextRequest) {
  try {
    const { productionTaskId, orderItemId, productId, quantity } = await request.json()
    const supabase = await createClient()

    console.log("[v0] Завершаю производство для задачи:", productionTaskId)

    // Обновляем статус задачи на completed
    await supabase
      .from("production_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", productionTaskId)

    // Обновляем инвентарь - добавляем готовую продукцию
    const { data: inventory, error: invError } = await supabase
      .from("inventory")
      .select("id, quantity_in_stock")
      .eq("product_id", productId)
      .eq("warehouse_location", "HOME")
      .maybeSingle()

    if (!inventory) {
      // Создаем новую запись инвентаря если не существует
      await supabase.from("inventory").insert({
        product_id: productId,
        warehouse_location: "HOME",
        quantity_in_stock: quantity,
        quantity_reserved: 0,
      })
    } else {
      // Обновляем существующую запись
      await supabase
        .from("inventory")
        .update({
          quantity_in_stock: inventory.quantity_in_stock + quantity,
        })
        .eq("id", inventory.id)
    }

    // Обновляем статус позиции заказа на ready
    await supabase
      .from("order_items")
      .update({
        fulfillment_status: "ready",
      })
      .eq("id", orderItemId)

    // Обновляем статус заказа на READY_TO_SHIP
    const { data: orderItem } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("id", orderItemId)
      .maybeSingle()

    if (orderItem) {
      const orderFlowStatus = mapOperationalToOrderFlowStatus("READY_TO_SHIP")
      await supabase
        .from("orders")
        .update({
          operational_status: "READY_TO_SHIP",
          order_flow_status: orderFlowStatus,
        })
        .eq("id", orderItem.order_id)
    }

    console.log("[v0] Производство завершено")

    return NextResponse.json({
      success: true,
      message: "Производство завершено, товар добавлен на склад",
    })
  } catch (error) {
    console.error("[v0] Ошибка при завершении производства:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 500 })
  }
}
