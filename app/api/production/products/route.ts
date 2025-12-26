import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("[v0] Ошибка получения товаров:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, products: products || [] })
  } catch (error) {
    console.error("[v0] Ошибка получения товаров:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

