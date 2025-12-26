import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { orderItemId, productId, quantity } = await request.json()
    const supabase = await createClient()

    console.log("[v0] Запускаю производство для товара:", productId)

    // Проверяем есть ли уже задача в production_queue
    const { data: existingTask } = await supabase
      .from("production_queue")
      .select("id")
      .eq("order_item_id", orderItemId)
      .maybeSingle()

    if (existingTask) {
      console.log("[v0] Задача производства уже существует, меняю статус на in_progress")

      // Обновляем статус на in_progress
      await supabase
        .from("production_queue")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", existingTask.id)
    } else {
      // Создаем новую задачу производства
      const { error: insertError } = await supabase.from("production_queue").insert({
        product_id: productId,
        quantity: quantity,
        order_item_id: orderItemId,
        status: "in_progress",
        priority: "normal",
        started_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("[v0] Ошибка создания задачи производства:", insertError)
        return NextResponse.json({ error: "Не удалось запустить производство" }, { status: 400 })
      }
    }

    // Обновляем статус позиции заказа
    await supabase
      .from("order_items")
      .update({
        fulfillment_status: "in_production",
      })
      .eq("id", orderItemId)

    console.log("[v0] Производство запущено")

    return NextResponse.json({
      success: true,
      message: "Производство запущено",
    })
  } catch (error) {
    console.error("[v0] Ошибка при запуске производства:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 500 })
  }
}
