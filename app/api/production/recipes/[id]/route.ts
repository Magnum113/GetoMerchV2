import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    const { name, description, production_time_minutes, materials, products } = body

    if (!name || !materials || materials.length === 0) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать название и материалы" },
        { status: 400 },
      )
    }

    // Обновляем рецепт
    const { error: recipeError } = await supabase
      .from("recipes")
      .update({
        name,
        description: description || null,
        production_time_minutes: production_time_minutes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (recipeError) {
      console.error("[v0] Ошибка обновления рецепта:", recipeError)
      return NextResponse.json(
        { success: false, error: recipeError.message || "Не удалось обновить рецепт" },
        { status: 500 },
      )
    }

    // Удаляем старые материалы
    const { error: deleteError } = await supabase.from("recipe_materials").delete().eq("recipe_id", id)

    if (deleteError) {
      console.error("[v0] Ошибка удаления старых материалов:", deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message || "Не удалось обновить материалы" },
        { status: 500 },
      )
    }

    // Удаляем старые продукты
    const { error: deleteProdError } = await supabase.from("recipe_products").delete().eq("recipe_id", id)
    if (deleteProdError) {
      console.error("[v0] Ошибка удаления старых продуктов:", deleteProdError)
      return NextResponse.json(
        { success: false, error: deleteProdError.message || "Не удалось обновить продукты" },
        { status: 500 },
      )
    }

    // Добавляем новые материалы (используем material_definition_id)
    const recipeMaterials = materials.map((m: any) => ({
      recipe_id: id,
      material_definition_id: m.material_definition_id,
      quantity_required: m.quantity_required,
    }))

    const { error: materialsError } = await supabase.from("recipe_materials").insert(recipeMaterials)

    if (materialsError) {
      console.error("[v0] Ошибка добавления материалов:", materialsError)
      return NextResponse.json(
        { success: false, error: materialsError.message || "Не удалось добавить материалы" },
        { status: 500 },
      )
    }

    // Добавляем новые продукты
    const recipeProducts = products.map((pid: string) => ({
      recipe_id: id,
      product_id: pid,
    }))
    const { error: prodError } = await supabase.from("recipe_products").insert(recipeProducts)
    if (prodError) {
      console.error("[v0] Ошибка добавления продуктов:", prodError)
      return NextResponse.json(
        { success: false, error: prodError.message || "Не удалось добавить продукты" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Ошибка обновления рецепта:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

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

