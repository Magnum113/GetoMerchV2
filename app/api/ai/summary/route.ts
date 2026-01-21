import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()

    // Собираем данные из базы для анализа
    const [ordersData, inventoryData, materialsData, productionData] = await Promise.all([
      // Заказы
      supabase.from("orders").select("*"),
      // Инвентарь
      supabase.from("inventory").select("*"),
      // Материалы
      supabase.from("material_availability").select("*"),
      // Производство
      supabase.from("production_queue").select("*").eq("status", "pending"),
    ])

    // Обрабатываем данные
    const orders = ordersData.data || []
    const inventory = inventoryData.data || []
    const materials = materialsData.data || []
    const production = productionData.data || []

    // Считаем ключевые метрики
    const totalOrders = orders.length
    const pendingOrders = orders.filter(o => o.status === "awaiting_packaging" || o.status === "awaiting_deliver")
    const completedOrders = orders.filter(o => o.status === "delivered").length
    const pendingRevenue = pendingOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)
    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)

    const lowStockItems = inventory.filter(item => {
      const stockLevel = Number(item.quantity_in_stock)
      const minLevel = Number(item.min_stock_level)
      return stockLevel <= minLevel
    }).length

    const lowStockMaterials = materials.filter(m => (m.available_quantity || 0) <= 10).length
    const criticalMaterials = materials.filter(m => (m.available_quantity || 0) < 5).length

    const pendingProduction = production.length

    // Собираем детальную информацию о товарах с низким запасом
    const lowStockProducts = inventory.filter(item => {
      const stockLevel = Number(item.quantity_in_stock)
      const minLevel = Number(item.min_stock_level)
      return stockLevel <= minLevel
    }).slice(0, 5) // Топ 5 самых критических

    // Собираем детальную информацию о критических материалах
    const criticalMaterialsList = materials.filter(m => (m.available_quantity || 0) < 5)
      .map(m => ({
        name: m.material_name,
        available: m.available_quantity || 0,
        unit: m.unit,
        attributes: m.attributes || {}
      }))
      .slice(0, 5) // Топ 5 самых критических

    // Собираем информацию о товарах в очереди производства
    const productionItems = await supabase
      .from("production_queue")
      .select("*, products(name, sku)")
      .eq("status", "pending")
      .limit(5)

    // Собираем детальную информацию о товарах в производстве
    const productionItemsData = productionItems.data || []
    const productionProducts = productionItemsData.map(item => ({
      name: item.products?.name || "Неизвестно",
      sku: item.products?.sku || "N/A",
      quantity: item.quantity
    }))

    // Создаем контекст для ИИ
    const context = {
      date: new Date().toLocaleDateString("ru-RU"),
      orders: {
        total: totalOrders,
        pending: pendingOrders.length,
        completed: completedOrders,
        pendingRevenue: Math.round(pendingRevenue),
        totalRevenue: Math.round(totalRevenue),
      },
      inventory: {
        lowStockItems: lowStockItems,
        totalItems: inventory.length,
        criticalProducts: lowStockProducts.map(p => ({
          name: p.products?.name || "Неизвестный товар",
          sku: p.sku || "N/A",
          stock: p.quantity_in_stock || 0,
          minStock: p.min_stock_level || 0
        })),
      },
      materials: {
        lowStock: lowStockMaterials,
        critical: criticalMaterials,
        total: materials.length,
        criticalMaterialsList: criticalMaterialsList,
      },
      production: {
        pending: pendingProduction,
        productionProducts: productionProducts,
      },
    }

    // Проверяем наличие переменных окружения для OpenRouter
    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    const openRouterApiUrl = process.env.OPENROUTER_API_URL
    const openRouterModel = process.env.OPENROUTER_MODEL

    if (!openRouterApiKey || !openRouterApiUrl || !openRouterModel) {
      console.error("OpenRouter API credentials are missing")
      return NextResponse.json(
        { 
          summary: generateFallbackSummary(context),
          context 
        },
        { status: 200 }
      )
    }

    // Генерируем промпт для ИИ
    const prompt = `
      Ты - опытный бизнес-аналитик, помогающий владельцу интернет-магазина на Ozon. 
      Предоставь детальную и практическую сводку на сегодняшний день.
      
      Текущая дата: ${context.date}
      
      Данные:
      - Заказы: всего ${context.orders.total}, в обработке ${context.orders.pending}, выполнено ${context.orders.completed}, выручка от текущих заказов: ${context.orders.pendingRevenue} ₽
      - Инвентарь: ${context.inventory.totalItems} товаров, ${context.inventory.lowStockItems} с низким запасом
      - Материалы: ${context.materials.total} типов, ${context.materials.lowStock} с низким запасом, ${context.materials.critical} критических
      - Производство: ${context.production.pending} задач в очереди
      
      Детальная информация:
      - Критические товары: ${context.inventory.criticalProducts.map(p => `${p.name} (SKU: ${p.sku}, на складе: ${p.stock}, минимум: ${p.minStock})`).join(", ")}
      - Критические материалы: ${context.materials.criticalMaterialsList.map(m => `${m.name} (доступно: ${m.available} ${m.unit}, атрибуты: ${JSON.stringify(m.attributes)})`).join(", ")}
      - Товары в производстве: ${context.production.productionProducts.map(p => `${p.name} (SKU: ${p.sku}, количество: ${p.quantity})`).join(", ")}
      
      Сгенерируй детальную сводку на русском языке с конкретными рекомендациями.
      Формат:
      1. Краткое резюме текущей ситуации (1-2 предложения)
      2. Конкретные проблемы и рекомендации по каждому направлению
      3. Приоритетные задачи на сегодня
      4. Советы по оптимизации
      
      Будь максимально конкретным, используй названия товаров и материалов, указывай точные цифры.
      Если есть критические проблемы, выдели их и предложи решения.
      Используй маркерные списки для четкости.
    `

    // Вызываем OpenRouter API
    const response = await fetch(openRouterApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          {
            role: "system",
            content: "Ты - бизнес-аналитик, помогающий владельцу интернет-магазина на Ozon.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      console.error("OpenRouter API error:", await response.text())
      return NextResponse.json(
        { 
          summary: generateFallbackSummary(context),
          context 
        },
        { status: 200 }
      )
    }

    const aiResponse = await response.json()
    const aiSummary = aiResponse.choices?.[0]?.message?.content || generateFallbackSummary(context)

    return NextResponse.json(
      { 
        summary: aiSummary,
        context 
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("AI Summary Error:", error)
    return NextResponse.json(
      { 
        error: "Не удалось сгенерировать сводку",
        details: error instanceof Error ? error.message : "Неизвестная ошибка"
      },
      { status: 500 }
    )
  }
}

// Функция для генерации резервной сводки, если ИИ недоступен
function generateFallbackSummary(context: any): string {
  const insights = []

  if (context.orders.pending > 0) {
    insights.push(`📦 В обработке ${context.orders.pending} заказов на сумму ${context.orders.pendingRevenue || context.orders.revenue} ₽`)
  }

  if (context.inventory.criticalProducts && context.inventory.criticalProducts.length > 0) {
    const productDetails = context.inventory.criticalProducts.slice(0, 3).map(p => 
      `${p.name} (SKU: ${p.sku}, на складе: ${p.stock}, минимум: ${p.minStock})`
    ).join(", ")
    insights.push(`⚠️ Товары с низким запасом: ${productDetails}`)
  }

  if (context.materials.criticalMaterialsList && context.materials.criticalMaterialsList.length > 0) {
    const materialDetails = context.materials.criticalMaterialsList.slice(0, 3).map(m => 
      `${m.name} (доступно: ${m.available} ${m.unit})`
    ).join(", ")
    insights.push(`🔴 Критические материалы: ${materialDetails}`)
  }

  if (context.production.productionProducts && context.production.productionProducts.length > 0) {
    const productionDetails = context.production.productionProducts.slice(0, 3).map(p => 
      `${p.name} (${p.quantity} шт)`
    ).join(", ")
    insights.push(`🏭 В производстве: ${productionDetails}`)
  }

  if (insights.length === 0) {
    return "🎉 Все показатели в норме! Нет срочных задач на сегодня."
  }

  return `📊 Сводка на ${context.date}:

${insights.join('\n')}

💡 Рекомендации:
- Закажите критические материалы
- Пополните запасы товаров с низким уровнем
- Обработайте заказы в очереди производства`
}
