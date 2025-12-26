import { createClient } from "@/lib/supabase/server"
import type { FulfillmentDecision, FulfillmentEvent } from "@/lib/types/fulfillment"

export class FulfillmentService {
  private supabase: any

  constructor(supabase?: any) {
    this.supabase = supabase
  }

  async init() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
  }

  /**
   * Автоматически определяет сценарий исполнения для позиции заказа
   * Ключевая логика системы - определяет КАК будет исполнен заказ
   */
  async decideFulfillmentScenario(
    productId: string,
    quantity: number,
    warehouseType: "FBS" | "FBO",
  ): Promise<FulfillmentDecision> {
    await this.init()

    console.log("[v0] FulfillmentService: определяем сценарий для товара", {
      productId,
      quantity,
      warehouseType,
    })

    // FBO - товар исполняет сам Ozon, не трогаем наш склад
    if (warehouseType === "FBO") {
      return {
        type: "FBO",
        source: "OZON_FBO",
        canFulfill: true,
        reason: "Заказ исполняется через склад Ozon (FBO)",
        requiredQuantity: quantity,
        needsProduction: false,
      }
    }

    // FBS - проверяем наличие на нашем складе
    const { data: inventory } = await this.supabase
      .from("inventory")
      .select("*")
      .eq("product_id", productId)
      .eq("warehouse_location", "HOME")
      .maybeSingle()

    const availableStock = inventory ? inventory.quantity_in_stock - inventory.quantity_reserved : 0

    console.log("[v0] FulfillmentService: проверка склада", {
      productId,
      availableStock,
      requiredQuantity: quantity,
    })

    // Сценарий 1: Достаточно товара на складе - READY_STOCK
    if (availableStock >= quantity) {
      return {
        type: "READY_STOCK",
        source: "HOME",
        canFulfill: true,
        reason: `Товар есть на складе (доступно: ${availableStock}, требуется: ${quantity})`,
        availableStock,
        requiredQuantity: quantity,
        needsProduction: false,
      }
    }

    // Сценарий 2: Товара нет или недостаточно - проверяем возможность производства
    const productionFeasibility = await this.checkProductionFeasibility(productId, quantity)

    if (productionFeasibility.canProduce) {
      return {
        type: "PRODUCE_ON_DEMAND",
        source: "PRODUCTION",
        canFulfill: true,
        reason: productionFeasibility.hasMaterials
          ? `Требуется производство. Все материалы в наличии.`
          : `Требуется производство. ВНИМАНИЕ: Не хватает материалов!`,
        availableStock,
        requiredQuantity: quantity,
        needsProduction: true,
        hasMaterials: productionFeasibility.hasMaterials,
        missingMaterials: productionFeasibility.missingMaterials,
      }
    }

    // Сценарий 3: Невозможно исполнить - нет рецепта или материалов
    return {
      type: "PRODUCE_ON_DEMAND",
      source: "PRODUCTION",
      canFulfill: false,
      reason: `Невозможно исполнить: ${productionFeasibility.reason}`,
      availableStock,
      requiredQuantity: quantity,
      needsProduction: true,
      hasMaterials: false,
      missingMaterials: productionFeasibility.missingMaterials,
    }
  }

  /**
   * Проверяет возможность производства товара
   */
  private async checkProductionFeasibility(productId: string, quantity: number) {
    // Проверяем наличие рецепта
    const { data: recipe } = await this.supabase
      .from("recipes")
      .select(
        `
        *,
        recipe_materials (
          quantity_needed,
          material:materials (
            id,
            name,
            sku,
            quantity_in_stock
          )
        )
      `,
      )
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle()

    if (!recipe) {
      return {
        canProduce: false,
        hasMaterials: false,
        reason: "Рецепт производства не найден",
        missingMaterials: [],
      }
    }

    // Проверяем наличие всех материалов
    const missingMaterials: Array<{
      material_id: string
      name: string
      required: number
      available: number
      shortage: number
    }> = []

    let hasMaterials = true

    for (const rm of recipe.recipe_materials || []) {
      const requiredQuantity = rm.quantity_needed * quantity
      const availableQuantity = rm.material?.quantity_in_stock || 0

      if (availableQuantity < requiredQuantity) {
        hasMaterials = false
        missingMaterials.push({
          material_id: rm.material.id,
          name: rm.material.name,
          required: requiredQuantity,
          available: availableQuantity,
          shortage: requiredQuantity - availableQuantity,
        })
      }
    }

    return {
      canProduce: true,
      hasMaterials,
      reason: hasMaterials ? "Все материалы в наличии" : "Недостаточно материалов",
      missingMaterials,
    }
  }

  /**
   * Применяет выбранный сценарий исполнения к позиции заказа
   */
  async applyFulfillmentScenario(orderItemId: string, decision: FulfillmentDecision): Promise<boolean> {
    await this.init()

    try {
      // Обновляем order_item с выбранным сценарием
      const { error: updateError } = await this.supabase
        .from("order_items")
        .update({
          fulfillment_type: decision.type,
          fulfillment_source: decision.source,
          fulfillment_status: "planned",
          fulfillment_notes: decision.reason,
          fulfillment_decided_at: new Date().toISOString(),
        })
        .eq("id", orderItemId)

      if (updateError) {
        console.error("[v0] FulfillmentService: ошибка применения сценария", updateError)
        return false
      }

      // Логируем событие
      await this.logEvent(orderItemId, "scenario_decided", {
        decision_type: decision.type,
        decision_source: decision.source,
        can_fulfill: decision.canFulfill,
        reason: decision.reason,
        needs_production: decision.needsProduction,
        has_materials: decision.hasMaterials,
        missing_materials: decision.missingMaterials,
      })

      console.log("[v0] FulfillmentService: сценарий применен", {
        orderItemId,
        type: decision.type,
      })

      return true
    } catch (error) {
      console.error("[v0] FulfillmentService: критическая ошибка применения сценария", error)
      return false
    }
  }

  /**
   * Резервирует товар на складе для READY_STOCK сценария
   */
  async reserveStock(productId: string, quantity: number, orderItemId: string): Promise<boolean> {
    await this.init()

    try {
      const { data: inventory } = await this.supabase
        .from("inventory")
        .select("*")
        .eq("product_id", productId)
        .eq("warehouse_location", "HOME")
        .maybeSingle()

      if (!inventory) {
        // Создаем запись если её нет
        const { error: createError } = await this.supabase.from("inventory").insert({
          product_id: productId,
          warehouse_location: "HOME",
          quantity_in_stock: 0,
          quantity_reserved: quantity,
          min_stock_level: 0,
        })

        return !createError
      }

      // Обновляем резерв
      const { error: updateError } = await this.supabase
        .from("inventory")
        .update({
          quantity_reserved: inventory.quantity_reserved + quantity,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", inventory.id)

      if (!updateError) {
        await this.logEvent(orderItemId, "materials_reserved", {
          product_id: productId,
          quantity,
          warehouse: "HOME",
        })
      }

      return !updateError
    } catch (error) {
      console.error("[v0] FulfillmentService: ошибка резервирования", error)
      return false
    }
  }

  /**
   * Создает задачу производства для PRODUCE_ON_DEMAND сценария
   */
  async createProduction(
    productId: string,
    quantity: number,
    orderId: string,
    orderItemId: string,
    priority: "high" | "normal" | "low" = "normal",
  ): Promise<string | null> {
    await this.init()

    try {
      // Создаем задачу в очереди производства
      const { data: production, error: createError } = await this.supabase
        .from("production_queue")
        .insert({
          product_id: productId,
          quantity,
          order_id: orderId,
          order_item_id: orderItemId,
          priority,
          status: "pending",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 дней
        })
        .select()
        .single()

      if (createError) {
        console.error("[v0] FulfillmentService: ошибка создания производства", createError)
        return null
      }

      // Связываем order_item с производством
      await this.supabase
        .from("order_items")
        .update({
          production_queue_id: production.id,
          fulfillment_status: "in_production",
        })
        .eq("id", orderItemId)

      // Резервируем материалы
      const materialsReserved = await this.reserveMaterials(productId, quantity, orderItemId)

      // Логируем событие
      await this.logEvent(orderItemId, "production_created", {
        production_id: production.id,
        product_id: productId,
        quantity,
        priority,
        materials_reserved: materialsReserved,
      })

      console.log("[v0] FulfillmentService: производство создано", {
        productionId: production.id,
        orderItemId,
      })

      return production.id
    } catch (error) {
      console.error("[v0] FulfillmentService: критическая ошибка создания производства", error)
      return null
    }
  }

  /**
   * Резервирует материалы для производства
   */
  private async reserveMaterials(productId: string, quantity: number, orderItemId: string): Promise<boolean> {
    try {
      // Получаем рецепт
      const { data: recipe } = await this.supabase
        .from("recipes")
        .select(
          `
          *,
          recipe_materials (
            quantity_needed,
            material_id,
            material:materials (
              id,
              quantity_in_stock
            )
          )
        `,
        )
        .eq("product_id", productId)
        .eq("is_active", true)
        .maybeSingle()

      if (!recipe) return false

      // Списываем материалы
      for (const rm of recipe.recipe_materials || []) {
        const requiredQuantity = rm.quantity_needed * quantity

        await this.supabase
          .from("materials")
          .update({
            quantity_in_stock: rm.material.quantity_in_stock - requiredQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rm.material_id)
      }

      await this.logEvent(orderItemId, "materials_reserved", {
        product_id: productId,
        quantity,
        recipe_id: recipe.id,
      })

      return true
    } catch (error) {
      console.error("[v0] FulfillmentService: ошибка резервирования материалов", error)
      return false
    }
  }

  /**
   * Логирует событие в fulfillment flow
   */
  private async logEvent(
    orderItemId: string,
    eventType: FulfillmentEvent["event_type"],
    eventData?: Record<string, any>,
  ): Promise<void> {
    if (!orderItemId) {
      console.warn("[v0] FulfillmentService: пропуск логирования - orderItemId undefined")
      return
    }

    try {
      await this.supabase.from("fulfillment_events").insert({
        order_item_id: orderItemId,
        event_type: eventType,
        event_data: eventData || {},
        created_by: "system",
      })
    } catch (error) {
      console.error("[v0] FulfillmentService: ошибка логирования события", error)
    }
  }
}
