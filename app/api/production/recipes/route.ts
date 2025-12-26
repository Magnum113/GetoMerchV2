import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { product_ids, name, description, production_time_minutes, materials } = body

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0 || !name || !materials || materials.length === 0) {
      return NextResponse.json(
        { success: false, error: "Необходимо указать товары, название и материалы" },
        { status: 400 },
      )
    }

    // Проверяем, нет ли уже рецепта для этих товаров
    const { data: existingRecipes } = await supabase
      .from("recipe_products")
      .select("recipe_id")
      .in("product_id", product_ids)

    if (existingRecipes && existingRecipes.length > 0) {
      const recipeIds = [...new Set(existingRecipes.map((r) => r.recipe_id))]
      return NextResponse.json(
        { success: false, error: `Некоторые товары уже связаны с рецептами (ID: ${recipeIds.join(", ")})` },
        { status: 400 },
      )
    }

    // Создаем рецепт
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        name,
        description: description || null,
        production_time_minutes: production_time_minutes || null,
        is_active: true,
      })
      .select()
      .single()

    if (recipeError || !recipe) {
      console.error("[v0] Ошибка создания рецепта:", recipeError)
      return NextResponse.json(
        { success: false, error: recipeError?.message || "Не удалось создать рецепт" },
        { status: 500 },
      )
    }

    // Связываем рецепт с товарами
    const recipeProducts = product_ids.map((productId: string) => ({
      recipe_id: recipe.id,
      product_id: productId,
    }))

    const { error: productsError } = await supabase.from("recipe_products").insert(recipeProducts)

    if (productsError) {
      console.error("[v0] Ошибка связывания товаров:", productsError)
      // Удаляем созданный рецепт если не удалось связать товары
      await supabase.from("recipes").delete().eq("id", recipe.id)
      return NextResponse.json(
        { success: false, error: productsError.message || "Не удалось связать товары" },
        { status: 500 },
      )
    }

    // Добавляем материалы (используем material_definition_id)
    const recipeMaterials = materials.map((m: any) => ({
      recipe_id: recipe.id,
      material_definition_id: m.material_definition_id,
      quantity_required: m.quantity_required,
    }))

    const { error: materialsError } = await supabase.from("recipe_materials").insert(recipeMaterials)

    if (materialsError) {
      console.error("[v0] Ошибка добавления материалов:", materialsError)
      // Удаляем созданный рецепт и связи если не удалось добавить материалы
      await supabase.from("recipe_products").delete().eq("recipe_id", recipe.id)
      await supabase.from("recipes").delete().eq("id", recipe.id)
      return NextResponse.json(
        { success: false, error: materialsError.message || "Не удалось добавить материалы" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, recipe })
  } catch (error) {
    console.error("[v0] Ошибка создания рецепта:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}
