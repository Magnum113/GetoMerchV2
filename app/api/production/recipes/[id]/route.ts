import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // PUT function implementation will go here
  return NextResponse.json({ success: false, error: "PUT method not implemented" }, { status: 501 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Check if the recipe exists
    const { data: recipe, error: fetchError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !recipe) {
      console.error("[v0] Ошибка получения рецепта:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError?.message || "Рецепт не найден" },
        { status: 404 },
      )
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from("recipes")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (deleteError) {
      console.error("[v0] Ошибка удаления рецепта:", deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message || "Не удалось удалить рецепт" },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Рецепт успешно удалён (деактивирован)" 
      },
    )
  } catch (error) {
    console.error("[v0] Ошибка удаления рецепта:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Неизвестная ошибка" 
      },
      { status: 500 },
    )
  }
}

