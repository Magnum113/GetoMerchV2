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

    // Delete the production queue item
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

    return NextResponse.json(
      { 
        success: true, 
        message: "Элемент очереди производства успешно удалён" 
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
