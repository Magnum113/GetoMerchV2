import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OzonClient } from "@/lib/ozon/client"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const ozonClient = new OzonClient()

    console.log("[v0] Starting stock sync...")

    // Get all products from database
    const { data: products } = await supabase.from("products").select("id, ozon_product_id, sku").eq("is_active", true)

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Нет активных товаров для синхронизации",
      })
    }

    console.log(`[v0] Found ${products.length} active products to sync stocks`)

    const productIds = products.map((p) => Number.parseInt(p.ozon_product_id))
    const stocksResponse = await ozonClient.getProductStocks(productIds)

    console.log(`[v0] Got stocks for ${stocksResponse.result?.items?.length || 0} products`)

    let syncedCount = 0

    for (const stock of stocksResponse.result?.items || []) {
      const product = products.find((p) => p.ozon_product_id === stock.product_id.toString())

      if (product) {
        // Upsert inventory
        await supabase.from("inventory").upsert(
          {
            product_id: product.id,
            warehouse_location: "Main Warehouse",
            quantity_in_stock: stock.stocks?.present || 0,
            quantity_reserved: stock.stocks?.reserved || 0,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "product_id,warehouse_location" },
        )
        syncedCount++
      }
    }

    console.log(`[v0] Stock sync completed: ${syncedCount} items synced`)

    return NextResponse.json({
      success: true,
      items_synced: syncedCount,
    })
  } catch (error) {
    console.error("[v0] Stock sync failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка синхронизации остатков",
      },
      { status: 500 },
    )
  }
}
