import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productionId, productId, quantity } = body

    if (!productionId || !productId || !quantity) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the recipe and check materials
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select(
        `
        *,
        recipe_materials(
          *,
          materials(*)
        )
      `,
      )
      .eq("product_id", productId)
      .single()

    if (recipeError || !recipe) {
      return NextResponse.json({ success: false, error: "Recipe not found" }, { status: 404 })
    }

    // Check if we have enough materials
    for (const rm of recipe.recipe_materials || []) {
      const material = rm.materials
      const requiredQuantity = rm.quantity_needed * quantity

      if (material && material.quantity_in_stock < requiredQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient ${material.name}: need ${requiredQuantity} ${material.unit}, have ${material.quantity_in_stock}`,
          },
          { status: 400 },
        )
      }
    }

    // Deduct materials
    for (const rm of recipe.recipe_materials || []) {
      const material = rm.materials
      const requiredQuantity = rm.quantity_needed * quantity

      if (material) {
        await supabase
          .from("materials")
          .update({
            quantity_in_stock: material.quantity_in_stock - requiredQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", material.id)
      }
    }

    // Update production status
    await supabase
      .from("production_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productionId)

    // Update inventory - add produced items to stock
    const { data: inventory } = await supabase.from("inventory").select("*").eq("product_id", productId).single()

    if (inventory) {
      await supabase
        .from("inventory")
        .update({
          quantity_in_stock: inventory.quantity_in_stock + quantity,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", inventory.id)
    } else {
      // Create inventory entry if it doesn't exist
      await supabase.from("inventory").insert({
        product_id: productId,
        warehouse_location: "Main Warehouse",
        quantity_in_stock: quantity,
        quantity_reserved: 0,
        min_stock_level: 15,
        last_updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Complete production failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete production",
      },
      { status: 500 },
    )
  }
}
