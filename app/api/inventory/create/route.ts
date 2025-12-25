import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, quantity, minStockLevel, warehouseLocation } = body

    if (!productId) {
      return NextResponse.json({ error: "Не указан товар" }, { status: 400 })
    }

    const supabase = await createClient()

    // Проверяем что товар существует
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("id", productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 })
    }

    // Проверяем что запись инвентаря еще не существует
    const { data: existing } = await supabase
      .from("inventory")
      .select("id")
      .eq("product_id", productId)
      .eq("warehouse_location", warehouseLocation)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Этот товар уже добавлен на данный склад" }, { status: 400 })
    }

    // Создаем запись инвентаря
    const { data: inventory, error: createError } = await supabase
      .from("inventory")
      .insert({
        product_id: productId,
        quantity_in_stock: quantity || 0,
        quantity_reserved: 0,
        min_stock_level: minStockLevel || 5,
        warehouse_location: warehouseLocation,
        last_updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error("Ошибка создания инвентаря:", createError)
      return NextResponse.json({ error: "Не удалось создать запись инвентаря" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inventory,
      message: `Товар "${product.name || product.sku}" добавлен на склад`,
    })
  } catch (error) {
    console.error("Ошибка API создания инвентаря:", error)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
