import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inventoryId, adjustment, reason } = body

    if (!inventoryId || adjustment === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current inventory
    const { data: inventory, error: fetchError } = await supabase
      .from("inventory")
      .select("*")
      .eq("id", inventoryId)
      .single()

    if (fetchError || !inventory) {
      return NextResponse.json({ success: false, error: "Inventory not found" }, { status: 404 })
    }

    // Calculate new stock level
    const newStock = inventory.quantity_in_stock + adjustment

    if (newStock < 0) {
      return NextResponse.json({ success: false, error: "Stock cannot be negative" }, { status: 400 })
    }

    // Update inventory
    const { error: updateError } = await supabase
      .from("inventory")
      .update({
        quantity_in_stock: newStock,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", inventoryId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      newStock,
      adjustment,
    })
  } catch (error) {
    console.error("Stock adjustment failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Stock adjustment failed",
      },
      { status: 500 },
    )
  }
}
