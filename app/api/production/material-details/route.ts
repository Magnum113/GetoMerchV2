import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { materialService } from "@/lib/services/material-service"
import { getWarehouseLabel, type WarehouseType } from "@/lib/types/warehouse"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipeId = searchParams.get("recipe_id")
    const quantity = Number.parseFloat(searchParams.get("quantity") || "1")

    if (!recipeId) {
      return NextResponse.json(
        { success: false, error: "Missing recipe_id parameter" },
        { status: 400 },
      )
    }

    // Получаем рецепт с материалами
    const supabase = await createClient()
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select(
        `
        id,
        name,
        recipe_materials(
          material_definition_id,
          quantity_required,
          material_definitions(id, name, unit)
        )
      `,
      )
      .eq("id", recipeId)
      .single()

    if (recipeError || !recipe) {
      return NextResponse.json(
        { success: false, error: "Recipe not found" },
        { status: 404 },
      )
    }

    // Получаем доступность материалов по складам
    const materialsDetails = []

    for (const rm of recipe.recipe_materials || []) {
      const materialDef = rm.material_definitions
      if (!materialDef || !rm.material_definition_id) continue

      const requiredQuantity = Number.parseFloat(rm.quantity_required || 0) * quantity
      const warehouseAvailability = await materialService.getAvailableQuantityByWarehouse(
        rm.material_definition_id,
      )

      const totalAvailable = warehouseAvailability.HOME + warehouseAvailability.PRODUCTION_CENTER
      const deficit = requiredQuantity - totalAvailable

      materialsDetails.push({
        material_definition_id: rm.material_definition_id,
        material_name: materialDef.name,
        unit: materialDef.unit,
        required_quantity: requiredQuantity,
        warehouse_availability: {
          HOME: {
            available: warehouseAvailability.HOME,
            label: getWarehouseLabel("HOME"),
          },
          PRODUCTION_CENTER: {
            available: warehouseAvailability.PRODUCTION_CENTER,
            label: getWarehouseLabel("PRODUCTION_CENTER"),
          },
        },
        total_available: totalAvailable,
        deficit: deficit > 0 ? deficit : 0,
        has_deficit: deficit > 0,
      })
    }

    return NextResponse.json({
      success: true,
      recipe_name: recipe.name,
      materials: materialsDetails,
      total_cost_estimate: materialsDetails.reduce(
        (sum, m) => sum + (m.required_quantity * 100), // Примерная оценка
        0,
      ),
    })
  } catch (error) {
    console.error("[v0] Ошибка получения деталей материалов для производства:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
