import { NextRequest, NextResponse } from "next/server"
import { materialService } from "@/lib/services/material-service"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, quantity = 1 } = body

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Получаем рецепт для товара
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select(
        `
        id,
        recipe_products!inner(products(id)),
        recipe_materials(
          material_definition_id,
          quantity_required,
          material_definitions(id, name, unit, attributes)
        )
      `,
      )
      .eq("recipe_products.products.id", productId)
      .single()

    if (recipeError || !recipe) {
      return NextResponse.json(
        { success: false, error: "Recipe not found for this product" },
        { status: 404 },
      )
    }

    // Проверяем доступность материалов
    const reservation = await materialService.reserveMaterialsForProduction(recipe.id, quantity)

    if (!reservation.success) {
      return NextResponse.json({
        success: false,
        canProduce: false,
        missingMaterials: reservation.missingMaterials,
        message: "Недостаточно материалов для производства",
      })
    }

    // Рассчитываем себестоимость
    const productionCost = materialService.calculateProductionCost(reservation.reservations)

    return NextResponse.json({
      success: true,
      canProduce: true,
      reservations: reservation.reservations,
      productionCost,
      message: "Материалы доступны. Производство возможно.",
    })
  } catch (error) {
    console.error("[v0] Ошибка проверки материалов:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

