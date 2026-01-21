import { parseColor, parseProductType, parseSize } from "@/lib/utils/product-attributes"

const SALES_WINDOW_DAYS = 30
const LOW_STOCK_THRESHOLD = 10
const CRITICAL_STOCK_THRESHOLD = 5

type SalesBreakdown = {
  key: string
  quantity: number
}

type MaterialNeed = {
  material_name: string
  unit: string | null
  needed: number
  available: number
  deficit: number
}

function toSortedArray(map: Map<string, number>, limit = 8): SalesBreakdown[] {
  return Array.from(map.entries())
    .map(([key, quantity]) => ({ key, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
}

export async function buildChatContext(supabase: any) {
  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - SALES_WINDOW_DAYS)
  const sinceIso = since.toISOString()

  const [materialsResult, inventoryResult, ordersResult, orderItemsResult] = await Promise.all([
    supabase.from("material_availability").select("material_definition_id, material_name, unit, available_quantity, total_quantity"),
    supabase
      .from("inventory")
      .select("product_id, quantity_in_stock, quantity_reserved, min_stock_level, products(name, sku)"),
    supabase.from("orders").select("id, total_amount, status, order_date").gte("order_date", sinceIso),
    supabase
      .from("order_items")
      .select("product_id, quantity, products(name, sku), orders!inner(order_date, status)")
      .gte("orders.order_date", sinceIso),
  ])

  const materials = materialsResult.data || []
  const inventory = inventoryResult.data || []
  const orders = ordersResult.data || []
  const orderItems = orderItemsResult.data || []

  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0)
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const lowStockMaterials = materials
    .filter((m: any) => Number(m.available_quantity || 0) <= LOW_STOCK_THRESHOLD)
    .map((m: any) => ({
      material_name: m.material_name,
      unit: m.unit,
      available_quantity: Number(m.available_quantity || 0),
      total_quantity: Number(m.total_quantity || 0),
    }))

  const criticalMaterials = lowStockMaterials.filter((m: any) => m.available_quantity < CRITICAL_STOCK_THRESHOLD)

  const inventoryMap = new Map<string, { name: string; sku: string; available: number; minStock: number }>()
  for (const row of inventory) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    if (!product) continue
    const available = Number(row.quantity_in_stock || 0) - Number(row.quantity_reserved || 0)
    const existing = inventoryMap.get(row.product_id) || {
      name: product.name,
      sku: product.sku,
      available: 0,
      minStock: Number(row.min_stock_level || 0),
    }
    existing.available += available
    existing.minStock = Math.max(existing.minStock, Number(row.min_stock_level || 0))
    inventoryMap.set(row.product_id, existing)
  }

  const lowStockProducts = Array.from(inventoryMap.values())
    .filter((item) => item.minStock > 0 && item.available <= item.minStock)
    .sort((a, b) => a.available - b.available)
    .slice(0, 10)

  const salesByType = new Map<string, number>()
  const tshirtByColor = new Map<string, number>()
  const tshirtBySize = new Map<string, number>()
  const tshirtByColorSize = new Map<string, number>()
  const tshirtSalesByProduct = new Map<string, number>()
  const productNameById = new Map<string, string>()

  for (const item of orderItems) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products
    if (!product) continue
    const productName = product.name || "Без названия"
    const type = parseProductType(productName)
    const color = parseColor(productName)
    const size = parseSize(productName)
    const quantity = Number(item.quantity || 0)
    const currentTypeQty = salesByType.get(type) || 0
    salesByType.set(type, currentTypeQty + quantity)

    if (type === "tshirt") {
      tshirtByColor.set(color, (tshirtByColor.get(color) || 0) + quantity)
      tshirtBySize.set(size, (tshirtBySize.get(size) || 0) + quantity)
      const colorSizeKey = `${color}_${size}`
      tshirtByColorSize.set(colorSizeKey, (tshirtByColorSize.get(colorSizeKey) || 0) + quantity)
      if (item.product_id) {
        tshirtSalesByProduct.set(item.product_id, (tshirtSalesByProduct.get(item.product_id) || 0) + quantity)
        productNameById.set(item.product_id, productName)
      }
    }
  }

  const tshirtProductIds = Array.from(tshirtSalesByProduct.keys())
  let tshirtMaterialNeeds: MaterialNeed[] = []

  if (tshirtProductIds.length > 0) {
    const { data: recipeProducts } = await supabase
      .from("recipe_products")
      .select("recipe_id, product_id")
      .in("product_id", tshirtProductIds)

    const recipeIdByProduct = new Map<string, string>()
    for (const row of recipeProducts || []) {
      if (row.product_id && row.recipe_id) {
        recipeIdByProduct.set(row.product_id, row.recipe_id)
      }
    }

    const recipeIds = Array.from(new Set(recipeIdByProduct.values()))

    if (recipeIds.length > 0) {
      const { data: recipeMaterials } = await supabase
        .from("recipe_materials")
        .select("recipe_id, material_definition_id, quantity_required, material_definitions(name, unit)")
        .in("recipe_id", recipeIds)

      const materialNeedsMap = new Map<string, MaterialNeed>()
      const materialAvailabilityMap = new Map<string, { available: number; unit: string | null; name: string }>()

      for (const material of materials) {
        if (!material.material_definition_id) continue
        materialAvailabilityMap.set(material.material_definition_id, {
          available: Number(material.available_quantity || 0),
          unit: material.unit || null,
          name: material.material_name,
        })
      }

      for (const [productId, soldQty] of tshirtSalesByProduct.entries()) {
        const recipeId = recipeIdByProduct.get(productId)
        if (!recipeId) continue
        const materialsForRecipe = (recipeMaterials || []).filter((rm: any) => rm.recipe_id === recipeId)
        for (const rm of materialsForRecipe) {
          const materialId = rm.material_definition_id
          if (!materialId) continue
          const materialName = rm.material_definitions?.name || "Неизвестный материал"
          const unit = rm.material_definitions?.unit || null
          const needed = Number(rm.quantity_required || 0) * soldQty
          const current = materialNeedsMap.get(materialId) || {
            material_name: materialName,
            unit,
            needed: 0,
            available: materialAvailabilityMap.get(materialId)?.available || 0,
            deficit: 0,
          }
          current.needed += needed
          current.deficit = Math.max(0, current.needed - current.available)
          materialNeedsMap.set(materialId, current)
        }
      }

      tshirtMaterialNeeds = Array.from(materialNeedsMap.values())
        .sort((a, b) => b.deficit - a.deficit)
        .slice(0, 10)
    }
  }

  return {
    generatedAt: now.toISOString(),
    salesWindowDays: SALES_WINDOW_DAYS,
    orders: {
      total: totalOrders,
      revenue: Math.round(totalRevenue),
      avgOrderValue,
    },
    inventory: {
      lowStockProducts,
    },
    materials: {
      lowStockMaterials: lowStockMaterials.slice(0, 10),
      criticalMaterials: criticalMaterials.slice(0, 10),
      thresholds: {
        low: LOW_STOCK_THRESHOLD,
        critical: CRITICAL_STOCK_THRESHOLD,
      },
    },
    sales: {
      byType: toSortedArray(salesByType),
      tshirts: {
        byColor: toSortedArray(tshirtByColor),
        bySize: toSortedArray(tshirtBySize),
        byColorSize: toSortedArray(tshirtByColorSize),
      },
    },
    tshirtMaterialNeeds,
  }
}

export function generateFallbackChatResponse(context: any, question: string) {
  const lines: string[] = []
  lines.push(`Не удалось обратиться к ИИ. Вот краткая сводка по данным на ${new Date(context.generatedAt).toLocaleString("ru-RU")}:`)

  if (context.materials?.criticalMaterials?.length) {
    const critical = context.materials.criticalMaterials
      .map((m: any) => `${m.material_name} (${m.available_quantity} ${m.unit || ""})`)
      .join(", ")
    lines.push(`Критические материалы: ${critical}`)
  }

  if (context.tshirtMaterialNeeds?.length) {
    const needs = context.tshirtMaterialNeeds
      .filter((m: any) => m.deficit > 0)
      .slice(0, 5)
      .map((m: any) => `${m.material_name} (дефицит ${Math.round(m.deficit)} ${m.unit || ""})`)
      .join(", ")
    if (needs) {
      lines.push(`Материалы под футболки, которые стоит заказать: ${needs}`)
    }
  }

  if (context.sales?.tshirts?.byColor?.length) {
    const topColor = context.sales.tshirts.byColor[0]
    lines.push(`Самый продаваемый цвет футболок за ${context.salesWindowDays} дней: ${topColor.key} (${topColor.quantity} шт.)`)
  }

  lines.push(`Вопрос пользователя: "${question}"`)
  lines.push("Для точных рекомендаций проверьте настройки OpenRouter.")

  return lines.join("\n")
}
