import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { materialService } from "@/lib/services/material-service"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const productionId = searchParams.get("production_id")

    if (productionId) {
      // Детали конкретного производства
      const materialDetails = await materialService.getProductionMaterialDetails(productionId)
      const totalCost = materialDetails.reduce((sum, m) => sum + m.total_cost, 0)

      // Получаем информацию о произведенном товаре
      const { data: production } = await supabase
        .from("production_queue")
        .select(
          `
          *,
          products(id, name, price)
        `,
        )
        .eq("id", productionId)
        .single()

      if (!production) {
        return NextResponse.json({ success: false, error: "Production not found" }, { status: 404 })
      }

      const productPrice = Number.parseFloat(production.products?.price || 0)
      const margin = productPrice - totalCost
      const marginPercent = productPrice > 0 ? (margin / productPrice) * 100 : 0

      return NextResponse.json({
        success: true,
        production: {
          id: productionId,
          product_name: production.products?.name,
          quantity: production.quantity,
          product_price: productPrice,
        },
        materials: materialDetails,
        cost: {
          total: totalCost,
          per_unit: production.quantity > 0 ? totalCost / production.quantity : 0,
        },
        margin: {
          total: margin,
          per_unit: production.quantity > 0 ? margin / production.quantity : 0,
          percent: marginPercent,
        },
      })
    }

    // Общая аналитика по поставщикам
    const { data: movements } = await supabase
      .from("material_movements")
      .select(
        `
        material_lot_id,
        quantity_change,
        material_lots(
          supplier_name,
          cost_per_unit,
          material_definition_id,
          material_definitions(name)
        )
      `,
      )
      .lt("quantity_change", 0) // Только списания
      .order("created_at", { ascending: false })
      .limit(1000)

    // Агрегируем по поставщикам
    const supplierStats = new Map<
      string,
      {
        supplier_name: string
        total_quantity: number
        total_cost: number
        material_count: number
      }
    >()

    movements?.forEach((mov: any) => {
      const lot = mov.material_lots
      if (!lot) return

      const supplier = lot.supplier_name || "Не указан"
      const quantity = Math.abs(Number.parseFloat(mov.quantity_change || 0))
      const cost = quantity * Number.parseFloat(lot.cost_per_unit || 0)

      const existing = supplierStats.get(supplier) || {
        supplier_name: supplier,
        total_quantity: 0,
        total_cost: 0,
        material_count: 0,
      }

      existing.total_quantity += quantity
      existing.total_cost += cost
      existing.material_count += 1

      supplierStats.set(supplier, existing)
    })

    return NextResponse.json({
      success: true,
      suppliers: Array.from(supplierStats.values()).sort((a, b) => b.total_cost - a.total_cost),
    })
  } catch (error) {
    console.error("[v0] Ошибка получения аналитики:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

