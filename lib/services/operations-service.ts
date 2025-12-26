import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type {
  ShipReadyOrder,
  ProductionNeeds,
  MaterialDeficit,
  ReplenishmentItem,
  OperationalStatus,
} from "@/lib/types/operations"

// Операционный сервис для расчета дневного плана
export class OperationsService {
  private supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => {
          const cookieStore = await cookies()
          return cookieStore.getAll()
        },
      },
    },
  )

  // БЛОК 1: Заказы готовые к отправке (готовый товар на складе)
  async getReadyToShipOrders(): Promise<ShipReadyOrder[]> {
    console.log("[v0] OperationsService: Получаю заказы готовые к отправке...")

    const { data, error } = await this.supabase
      .from("orders")
      .select(
        `
      id,
      order_number,
      customer_name,
      total_amount,
      operational_status,
      warehouse_type,
      order_items!inner(
        id,
        product_id,
        quantity,
        fulfillment_type,
        fulfillment_status,
        products(name)
      )
    `,
      )
      .eq("operational_status", "READY_TO_SHIP")
      .eq("warehouse_type", "FBS")

    if (error) {
      console.error("[v0] Ошибка получения заказов к отправке:", error)
      return []
    }

    return (data || []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      total_amount: order.total_amount,
      items: order.order_items.map((item: any) => ({
        product_name: item.products.name,
        quantity: item.quantity,
      })),
    }))
  }

  // БЛОК 2: Агрегированные производственные задачи
  async getAggregatedProductionNeeds(): Promise<ProductionNeeds[]> {
    console.log("[v0] OperationsService: Рассчитываю производственные потребности...")

    // Находим заказы которые ждут производства
    const { data: ordersNeedingProduction, error: ordersError } = await this.supabase
      .from("orders")
      .select(
        `
        id,
        order_items(
          id,
          product_id,
          quantity,
          fulfillment_type,
          products(name, id)
        )
      `,
      )
      .eq("operational_status", "WAITING_FOR_PRODUCTION")

    if (ordersError) {
      console.error("[v0] Ошибка получения заказов к производству:", ordersError)
      return []
    }

    // Агрегируем по товарам (несколько заказов → одна задача)
    const aggregated = new Map<string, { product_name: string; quantity: number; orders: number }>()
    ;(ordersNeedingProduction || []).forEach((order: any) => {
      order.order_items.forEach((item: any) => {
        const productId = item.product_id
        const existing = aggregated.get(productId)

        if (existing) {
          existing.quantity += item.quantity
          existing.orders += 1
        } else {
          aggregated.set(productId, {
            product_name: item.products.name,
            quantity: item.quantity,
            orders: 1,
          })
        }
      })
    })

    return Array.from(aggregated.values()).map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      orders_count: item.orders,
      priority: item.quantity > 5 ? "high" : "normal",
    }))
  }

  // БЛОК 3: Дефицит материалов для производства
  async getMaterialDeficits(): Promise<MaterialDeficit[]> {
    console.log("[v0] OperationsService: Анализирую дефицит материалов...")

    // Получаем все заказы, которые требуют производства
    const { data: ordersNeedingProduction, error: ordersError } = await this.supabase
      .from("orders")
      .select(
        `
        id,
        order_items!inner(
          id,
          product_id,
          quantity,
          fulfillment_type
        )
      `,
      )
      .in("operational_status", ["WAITING_FOR_PRODUCTION", "WAITING_FOR_MATERIALS", "IN_PRODUCTION"])

    if (ordersError) {
      console.error("[v0] Ошибка получения заказов для производства:", ordersError)
      return []
    }

    // Агрегируем потребности по товарам (включая READY_STOCK, которые требуют производства)
    const productNeeds = new Map<string, number>()
    ;(ordersNeedingProduction || []).forEach((order: any) => {
      order.order_items.forEach((item: any) => {
        // Учитываем PRODUCE_ON_DEMAND и READY_STOCK заказы, которые требуют производства
        if (item.fulfillment_type === "PRODUCE_ON_DEMAND" || item.fulfillment_type === "READY_STOCK") {
          const existing = productNeeds.get(item.product_id) || 0
          productNeeds.set(item.product_id, existing + item.quantity)
        }
      })
    })

    const deficits: MaterialDeficit[] = []
    const deficitMap = new Map<string, MaterialDeficit>()

    // Для каждого товара проверяем материалы
    for (const [productId, quantityNeeded] of productNeeds.entries()) {
      // Получаем рецепт товара через recipe_products
      const { data: recipeData } = await this.supabase
        .from("recipe_products")
        .select(
          `
          recipe_id,
          recipes(
            id,
            recipe_materials(
              material_definition_id,
              quantity_required,
              material_definitions(id, name, unit)
            )
          )
        `,
        )
        .eq("product_id", productId)
        .maybeSingle()

      const recipe = recipeData?.recipes

      if (!recipe) {
        console.log(`[v0] Рецепт не найден для товара ${productId} — считаем дефицитом`)
        deficitMap.set(`recipe:${productId}`, {
          material_name: `Рецепт отсутствует`,
          needed: quantityNeeded,
          have: 0,
          deficit: quantityNeeded,
          unit: "шт",
        })
        continue
      }

      // Проверяем каждый материал через material_definitions
      if (recipe?.recipe_materials) {
        for (const rm of recipe.recipe_materials) {
          const materialDef = rm.material_definitions
          if (!materialDef || !rm.material_definition_id) continue

          const needed = (rm.quantity_required || 0) * quantityNeeded
          
          // Получаем доступное количество через функцию БД
          const { data: availableData } = await this.supabase.rpc("get_material_definition_available_quantity", {
            def_id: rm.material_definition_id,
          })
          const have = Number.parseFloat(availableData || 0)
          const deficit = needed - have

          if (deficit > 0) {
            const materialName = materialDef.name
            const existing = deficitMap.get(materialName)

            if (existing) {
              // Агрегируем дефицит по материалам
              existing.needed += needed
              existing.deficit += deficit
            } else {
              deficitMap.set(materialName, {
                material_name: materialName,
                needed,
                have,
                deficit,
                unit: materialDef.unit || "шт",
              })
            }
          }
        }
      }
    }

    return Array.from(deficitMap.values())
  }

  // БЛОК 4: Что нужно заказать у поставщиков
  async getReplenishmentNeeds(): Promise<ReplenishmentItem[]> {
    console.log("[v0] OperationsService: Определяю что заказать...")

    const deficits = await this.getMaterialDeficits()
    const items: ReplenishmentItem[] = []

    for (const deficit of deficits) {
      // Получаем информацию о материале
      const { data: material } = await this.supabase
        .from("materials")
        .select("name, unit")
        .eq("name", deficit.material_name)
        .maybeSingle()

      if (material) {
        items.push({
          material_name: material.name,
          quantity_needed: Math.ceil(deficit.deficit),
          unit: material.unit,
          priority: deficit.deficit > 10 ? "high" : "normal",
        })
      }
    }

    return items
  }

  // Рассчитать операционный статус заказа
  async calculateOrderOperationalStatus(orderId: string, orderItemId: string): Promise<OperationalStatus> {
    console.log(`[v0] Рассчитываю операционный статус для заказа ${orderId}...`)

    // Получаем статус заказа (из Ozon)
    const { data: order } = await this.supabase.from("orders").select("status").eq("id", orderId).maybeSingle()

    // Получаем позицию заказа
    const { data: orderItem } = await this.supabase
      .from("order_items")
      .select("fulfillment_type, fulfillment_status, product_id, quantity")
      .eq("id", orderItemId)
      .maybeSingle()

    if (!orderItem) {
      console.log(`[v0] ✗ Позиция заказа ${orderItemId} не найдена`)
      return "BLOCKED"
    }

    // Если заказ уже доставлен/в пути/отменен - выводим из операционного потока
    if (order?.status) {
      const normalized = order.status.toLowerCase()
      if (normalized.includes("delivered")) {
        console.log(`[v0] ✓ Статус заказа=${order.status} → DONE`)
        return "DONE"
      }
      if (normalized.includes("delivering") || normalized.includes("return")) {
        console.log(`[v0] ✓ Статус заказа=${order.status} → SHIPPED`)
        return "SHIPPED"
      }
      if (normalized.includes("cancel") || normalized.includes("arbitration")) {
        console.log(`[v0] ✓ Статус заказа=${order.status} → BLOCKED`)
        return "BLOCKED"
      }
    }

    console.log(
      `[v0] Позиция: fulfillment_type=${orderItem.fulfillment_type}, fulfillment_status=${orderItem.fulfillment_status}`,
    )

    // Если FBO - не наша задача
    if (orderItem.fulfillment_type === "FBO") {
      console.log(`[v0] ✓ FBO заказ → PENDING`)
      return "PENDING"
    }

    // Если тип READY_STOCK - проверяем товар на складе
    if (orderItem.fulfillment_type === "READY_STOCK") {
      // ВСЕГДА проверяем реальное наличие на складе, даже если fulfillment_status = ready
      const { data: inventory } = await this.supabase
        .from("inventory")
        .select("quantity_in_stock, quantity_reserved")
        .eq("product_id", orderItem.product_id)
        .eq("warehouse_location", "HOME")
        .maybeSingle()

      const available = (inventory?.quantity_in_stock || 0) - (inventory?.quantity_reserved || 0)
      console.log(
        `[v0] READY_STOCK: stock=${inventory?.quantity_in_stock || 0}, reserved=${inventory?.quantity_reserved || 0}, available=${available}, need=${orderItem.quantity}`,
      )

      // Если товара нет на складе или недостаточно - нужно произвести
      if (!inventory || available < orderItem.quantity) {
        // Проверяем наличие материалов для производства
        const { data: recipeData } = await this.supabase
          .from("recipe_products")
          .select(
            `
            recipes(
              id,
              recipe_materials(
                material_definition_id,
                quantity_required,
                material_definitions(id, name)
              )
            )
          `,
          )
          .eq("product_id", orderItem.product_id)
          .maybeSingle()

        const recipe = recipeData?.recipes

        // Если есть рецепт, проверяем материалы
        if (recipe?.recipe_materials) {
          for (const rm of recipe.recipe_materials) {
            if (!rm.material_definition_id) continue

            const required = (rm.quantity_required || 0) * orderItem.quantity
            const { data: availableData } = await this.supabase.rpc("get_material_definition_available_quantity", {
              def_id: rm.material_definition_id,
            })
            const available = Number.parseFloat(availableData || 0)

            if (available < required) {
              const materialName = rm.material_definitions?.name || "Неизвестно"
              console.log(
                `[v0] ✗ READY_STOCK: Товара нет на складе И не хватает материала: ${materialName} (нужно ${required}, доступно ${available}) → WAITING_FOR_MATERIALS`,
              )
              return "WAITING_FOR_MATERIALS"
            }
          }
        } else if (recipe) {
          // Рецепт есть, но без материалов - считаем что материалов не хватает
          console.log(`[v0] ✗ READY_STOCK: Товара нет на складе, рецепт без материалов → WAITING_FOR_MATERIALS`)
          return "WAITING_FOR_MATERIALS"
        } else {
          // Нет рецепта - считаем что не хватает материалов/спецификации
          console.log(`[v0] ✗ READY_STOCK: Товара нет на складе, рецепт не найден → WAITING_FOR_MATERIALS`)
          return "WAITING_FOR_MATERIALS"
        }

        // Товара нет, но материалы есть - можно производить
        console.log(
          `[v0] ✗ READY_STOCK: Товара нет на складе (available=${available}, need=${orderItem.quantity}), но материалы есть → WAITING_FOR_PRODUCTION`,
        )
        return "WAITING_FOR_PRODUCTION"
      }

      // Только если товар реально есть на складе - готов к отправке
      console.log(`[v0] ✓ READY_STOCK: Товар на складе (available=${available}) → READY_TO_SHIP`)
      return "READY_TO_SHIP"
    }

    // Если запланировано производство
    if (orderItem.fulfillment_type === "PRODUCE_ON_DEMAND") {
      // Сначала проверяем, есть ли товар уже на складе (возможно, производство завершено)
      const { data: inventory } = await this.supabase
        .from("inventory")
        .select("quantity_in_stock, quantity_reserved")
        .eq("product_id", orderItem.product_id)
        .eq("warehouse_location", "HOME")
        .maybeSingle()

      const available = (inventory?.quantity_in_stock || 0) - (inventory?.quantity_reserved || 0)
      
      // Если товар есть на складе, значит производство завершено - готов к отправке
      if (inventory && available >= orderItem.quantity) {
        console.log(
          `[v0] ✓ PRODUCE_ON_DEMAND: Товар уже на складе (available=${available}, need=${orderItem.quantity}) → READY_TO_SHIP`,
        )
        return "READY_TO_SHIP"
      }

      // Проверяем есть ли задача в очереди (проверяем ДО проверки материалов, чтобы знать статус)
      const { data: productionTask } = await this.supabase
        .from("production_queue")
        .select("id, status")
        .eq("order_item_id", orderItemId)
        .maybeSingle()

      // Проверяем материалы через recipe_products и material_definitions
      const { data: recipeData } = await this.supabase
        .from("recipe_products")
        .select(
          `
          recipes(
            id,
            recipe_materials(
              material_definition_id,
              quantity_required,
              material_definitions(id, name)
            )
          )
        `,
        )
        .eq("product_id", orderItem.product_id)
        .maybeSingle()

      const recipe = recipeData?.recipes

      // Нет рецепта — считаем, что не хватает материалов/спецификации
      if (!recipe) {
        console.log(`[v0] ✗ PRODUCE_ON_DEMAND: Рецепт не найден → WAITING_FOR_MATERIALS`)
        return "WAITING_FOR_MATERIALS"
      }

      if (recipe?.recipe_materials) {
        // Проверяем доступность каждого материала
        for (const rm of recipe.recipe_materials) {
          if (!rm.material_definition_id) continue

          const required = (rm.quantity_required || 0) * orderItem.quantity
          const { data: availableData } = await this.supabase.rpc("get_material_definition_available_quantity", {
            def_id: rm.material_definition_id,
          })
          const available = Number.parseFloat(availableData || 0)

          if (available < required) {
            const materialName = rm.material_definitions?.name || "Неизвестно"
            console.log(
              `[v0] ✗ PRODUCE_ON_DEMAND: Не хватает материала: ${materialName} (нужно ${required}, доступно ${available}) → WAITING_FOR_MATERIALS`,
            )
            return "WAITING_FOR_MATERIALS"
          }
        }
      }

      // Если fulfillment_status = "in_production" или есть задача - значит в производстве
      if (orderItem.fulfillment_status === "in_production" || productionTask) {
        console.log(`[v0] ✓ PRODUCE_ON_DEMAND: Материалы есть, в производстве → IN_PRODUCTION`)
        return "IN_PRODUCTION"
      }

      // Материалы есть, но производство еще не начато
      console.log(`[v0] ✓ PRODUCE_ON_DEMAND: Материалы есть, ждет производства → WAITING_FOR_PRODUCTION`)
      return "WAITING_FOR_PRODUCTION"
    }

    console.log(`[v0] ⚠️  Не удалось определить статус → PENDING`)
    return "PENDING"
  }

  // Обновить операционные статусы всех заказов
  async updateAllOrdersOperationalStatus(): Promise<void> {
    console.log("[v0] Обновляю операционные статусы всех заказов...")

    const { data: orders } = await this.supabase.from("orders").select("id, order_items(id)")

    for (const order of orders || []) {
      // Для заказов с несколькими позициями определяем статус на основе всех позиций
      const itemStatuses: OperationalStatus[] = []
      
      for (const item of order.order_items || []) {
        const status = await this.calculateOrderOperationalStatus(order.id, item.id)
        itemStatuses.push(status)
      }

      // Определяем общий статус заказа на основе приоритета статусов
      // Приоритет: WAITING_FOR_MATERIALS > WAITING_FOR_PRODUCTION > IN_PRODUCTION > READY_TO_SHIP > остальные
      let finalStatus: OperationalStatus = "PENDING"
      
      if (itemStatuses.some((s) => s === "WAITING_FOR_MATERIALS")) {
        finalStatus = "WAITING_FOR_MATERIALS"
      } else if (itemStatuses.some((s) => s === "WAITING_FOR_PRODUCTION")) {
        finalStatus = "WAITING_FOR_PRODUCTION"
      } else if (itemStatuses.some((s) => s === "IN_PRODUCTION")) {
        finalStatus = "IN_PRODUCTION"
      } else if (itemStatuses.some((s) => s === "READY_TO_SHIP")) {
        finalStatus = "READY_TO_SHIP"
      } else if (itemStatuses.length > 0) {
        finalStatus = itemStatuses[0]
      }

      await this.supabase.from("orders").update({ operational_status: finalStatus }).eq("id", order.id)
    }

    console.log("[v0] Операционные статусы обновлены")
  }
}

export const operationsService = new OperationsService()
