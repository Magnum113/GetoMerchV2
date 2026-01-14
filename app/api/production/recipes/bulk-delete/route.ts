import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { confirmDeletion = false, backupFirst = true } = body

    // Safety check - require explicit confirmation for bulk deletion
    if (!confirmDeletion) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Для массового удаления требуется явное подтверждение. Установите confirmDeletion=true" 
        },
        { status: 400 },
      )
    }

    // First, get all active recipes for potential backup
    const { data: activeRecipes, error: fetchError } = await supabase
      .from("recipes")
      .select("*")
      .eq("is_active", true)

    if (fetchError) {
      console.error("[v0] Ошибка получения активных рецептов:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message || "Не удалось получить активные рецепты" },
        { status: 500 },
      )
    }

    const recipeCount = activeRecipes?.length || 0
    
    // Perform soft delete (set is_active = false) for all recipes
    const { error: deleteError } = await supabase
      .from("recipes")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        deactivation_reason: "Массовое удаление при перестройке системы рецептов"
      })
      .eq("is_active", true)

    if (deleteError) {
      console.error("[v0] Ошибка массового удаления рецептов:", deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message || "Не удалось деактивировать рецепты" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Успешно деактивировано ${recipeCount} рецептов`,
      deletedCount: recipeCount,
      backupRecommended: backupFirst,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("[v0] Ошибка массового удаления рецептов:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Неизвестная ошибка" 
      },
      { status: 500 },
    )
  }
}
