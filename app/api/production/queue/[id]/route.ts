import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Check if the production queue item exists and get its status
    const { data: queueItem, error: fetchError } = await supabase
      .from("production_queue")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !queueItem) {
      console.error("[v0] Ошибка получения элемента очереди:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError?.message || "Элемент очереди не найден" },
        { status: 404 },
      )
    }

    // Only allow deletion of pending items to prevent data inconsistency
    if (queueItem.status !== "pending") {
      return NextResponse.json(
        { 
          success: false, 
          error: `Нельзя удалить элемент со статусом "${queueItem.status}". Удаление разрешено только для элементов со статусом "pending"` 
        },
        { status: 400 },
      )
    }

    // Use SQL function to delete production queue item atomically
    // This ensures all operations happen in a single transaction
    const { data: result, error: rpcError } = await supabase.rpc('delete_production_queue_item', {
      queue_item_id: id
    })

    if (rpcError) {
      // If RPC function doesn't exist, fall back to manual approach
      if (rpcError.message?.includes('function') && rpcError.message?.includes('does not exist')) {
        console.log("[v0] SQL функция не найдена, используем ручной подход")
        
        // First, update all order_items that reference this production_queue_id
        const { data: updatedItems, error: updateError } = await supabase
          .from("order_items")
          .update({
            production_queue_id: null,
            fulfillment_status: "cancelled",
            fulfillment_notes: `Производство отменено: элемент очереди удалён`
          })
          .eq("production_queue_id", id)
          .select()

        if (updateError) {
          console.error("[v0] Ошибка обновления связанных заказов:", updateError)
          return NextResponse.json(
            { success: false, error: updateError.message || "Не удалось обновить связанные заказы" },
            { status: 500 },
          )
        }

        // Log how many items were updated for debugging
        if (updatedItems && updatedItems.length > 0) {
          console.log(`[v0] Обновлено ${updatedItems.length} связанных записей order_items`)
        }

        // Now delete the production queue item
        const { error: deleteError } = await supabase
          .from("production_queue")
          .delete()
          .eq("id", id)

        if (deleteError) {
          console.error("[v0] Ошибка удаления элемента очереди:", deleteError)
          return NextResponse.json(
            { success: false, error: deleteError.message || "Не удалось удалить элемент очереди" },
            { status: 500 },
          )
        }
      } else {
        console.error("[v0] Ошибка выполнения SQL функции:", rpcError)
        return NextResponse.json(
          { success: false, error: rpcError.message || "Не удалось удалить элемент очереди" },
          { status: 500 },
        )
      }
    } else if (result && !result.success) {
      // SQL function returned an error
      return NextResponse.json(
        { success: false, error: result.error || "Не удалось удалить элемент очереди" },
        { status: 400 },
      )
    }

    // Return success response
    // If we used the SQL function, use its result; otherwise use default message
    const message = result?.message || "Элемент очереди производства успешно удалён"
    return NextResponse.json(
      { 
        success: true, 
        message,
        ...(result?.updated_order_items !== undefined && { updated_order_items: result.updated_order_items })
      },
    )
  } catch (error) {
    console.error("[v0] Ошибка удаления элемента очереди:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Неизвестная ошибка" 
      },
      { status: 500 },
    )
  }
}
