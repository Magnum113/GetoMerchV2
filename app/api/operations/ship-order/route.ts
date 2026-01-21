import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { mapOperationalToOrderFlowStatus } from "@/lib/utils/order-status"

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    const supabase = await createClient()

    console.log("[v0] Отправляю заказ:", orderId)

    // Обновляем статус заказа на SHIPPED
    const orderFlowStatus = mapOperationalToOrderFlowStatus("SHIPPED")
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        operational_status: "SHIPPED",
        order_flow_status: orderFlowStatus,
        status: "awaiting_deliver",
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("[v0] Ошибка обновления статуса заказа:", updateError)
      return NextResponse.json({ error: "Не удалось отправить заказ" }, { status: 400 })
    }

    // Снимаем резерв с товаров
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId)

    for (const item of orderItems || []) {
      // Обновляем inventory - снимаем резерв
      await supabase.rpc("update_inventory_on_ship", {
        product_id: item.product_id,
        quantity: item.quantity,
      })
    }

    console.log("[v0] Заказ успешно отправлен")

    return NextResponse.json({
      success: true,
      message: "Заказ отправлен",
    })
  } catch (error) {
    console.error("[v0] Ошибка при отправке заказа:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 500 })
  }
}
