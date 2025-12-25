import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { productId, name, price, category, is_active } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: "ID товара обязателен" }, { status: 400 })
    }

    const supabase = await createClient()

    // Обновляем товар
    const { data: product, error: updateError } = await supabase
      .from("products")
      .update({
        name: name || null,
        price: price || null,
        category: category || null,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] Error updating product:", updateError)
      return NextResponse.json({ error: `Ошибка обновления товара: ${updateError.message}` }, { status: 500 })
    }

    console.log("[v0] Product updated successfully:", product.id)

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    console.error("[v0] Error in update product route:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка при обновлении товара" },
      { status: 500 },
    )
  }
}
