import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { OrderFlowStatus } from "@/lib/types/operations"
import type { FulfillmentType, FulfillmentStatus } from "@/lib/types/fulfillment"

export class FulfillmentService {
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

  // Get fulfillment scenario for an order
  async getFulfillmentScenario(orderId: string): Promise<{
    type: FulfillmentType
    status: FulfillmentStatus
    orderFlowStatus: OrderFlowStatus
    reason: string
    action: string
    canProceed: boolean
    missingMaterials?: string[]
  }> {
    const { data: order } = await this.supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        order_flow_status,
        operational_status,
        order_items(
          id,
          product_id,
          quantity,
          fulfillment_type,
          fulfillment_status,
          products(name)
        )
      `
      )
      .eq("id", orderId)
      .maybeSingle()

    if (!order) {
      return {
        type: "PENDING",
        status: "planned",
        orderFlowStatus: "NEW",
        reason: "Заказ не найден",
        action: "Проверьте данные заказа",
        canProceed: false
      }
    }

    // Check if order is in terminal state
    if (["DONE", "CANCELLED", "SHIPPED"].includes(order.order_flow_status)) {
      return {
        type: "FBO",
        status: "shipped",
        orderFlowStatus: order.order_flow_status,
        reason: `Заказ ${order.order_flow_status.toLowerCase()}`,
        action: "Нет действий требуется",
        canProceed: false
      }
    }

    // Get first order item to determine fulfillment type
    const firstItem = order.order_items?.[0]
    if (!firstItem) {
      return {
        type: "PENDING",
        status: "planned",
        orderFlowStatus: order.order_flow_status,
        reason: "Нет позиций в заказе",
        action: "Добавьте товары в заказ",
        canProceed: false
      }
    }

    // Determine scenario based on order flow status
    switch (order.order_flow_status) {
      case "READY_TO_SHIP":
        return {
          type: firstItem.fulfillment_type || "READY_STOCK",
          status: "ready",
          orderFlowStatus: order.order_flow_status,
          reason: "Товар на складе, готов к отправке",
          action: "Отправить заказ",
          canProceed: true
        }

      case "NEED_PRODUCTION":
        return {
          type: "PRODUCE_ON_DEMAND",
          status: "planned",
          orderFlowStatus: order.order_flow_status,
          reason: "Требуется производство, материалы доступны",
          action: "Запустить производство",
          canProceed: true
        }

      case "NEED_MATERIALS":
        // Get missing materials
        const missingMaterials = await this.getMissingMaterialsForOrder(orderId)
        return {
          type: "PRODUCE_ON_DEMAND",
          status: "planned",
          orderFlowStatus: order.order_flow_status,
          reason: `Не хватает материалов для производства`,
          action: "Заказать материалы",
          canProceed: false,
          missingMaterials: missingMaterials
        }

      case "IN_PRODUCTION":
        return {
          type: "PRODUCE_ON_DEMAND",
          status: "in_production",
          orderFlowStatus: order.order_flow_status,
          reason: "Заказ в производстве",
          action: "Мониторить производство",
          canProceed: false
        }

      case "NEW":
      case "NEW":
      default:
        return {
          type: firstItem.fulfillment_type || "PENDING",
          status: "planned",
          orderFlowStatus: order.order_flow_status,
          reason: "Ожидает обработки",
          action: "Пересчитать статусы",
          canProceed: false
        }
    }
  }

  // Get missing materials for an order
  async getMissingMaterialsForOrder(orderId: string): Promise<string[]> {
    const { data: order } = await this.supabase
      .from("orders")
      .select(
        `
        order_items(
          product_id,
          quantity
        )
      `
      )
      .eq("id", orderId)
      .maybeSingle()

    if (!order?.order_items) return []

    const missingMaterials: string[] = []

    for (const item of order.order_items) {
      // Get recipe for product
      const { data: recipeData } = await this.supabase
        .from("recipe_products")
        .select(
          `
          recipes(
            recipe_materials(
              material_definition_id,
              quantity_required,
              material_definitions(name)
            )
          )
        `
        )
        .eq("product_id", item.product_id)
        .maybeSingle()

      const recipe = recipeData?.recipes
      if (!recipe?.recipe_materials) continue

      // Check each material
      for (const rm of recipe.recipe_materials) {
        if (!rm.material_definition_id) continue

        const required = (rm.quantity_required || 0) * item.quantity

        // Check availability across warehouses
        const { data: homeAvailable } = await this.supabase.rpc("get_material_definition_available_quantity_by_warehouse", {
          def_id: rm.material_definition_id,
          warehouse_id_param: "HOME",
        })

        const { data: productionAvailable } = await this.supabase.rpc("get_material_definition_available_quantity_by_warehouse", {
          def_id: rm.material_definition_id,
          warehouse_id_param: "PRODUCTION_CENTER",
        })

        const totalAvailable = Number.parseFloat(homeAvailable || 0) + Number.parseFloat(productionAvailable || 0)

        if (totalAvailable < required) {
          const materialName = rm.material_definitions?.name || "Неизвестный материал"
          missingMaterials.push(`${materialName} (нужно: ${required}, есть: ${totalAvailable})`)
        }
      }
    }

    return missingMaterials
  }

  // Get all active orders with fulfillment scenarios
  async getActiveOrdersWithScenarios(): Promise<Array<{
    order_id: string
    order_number: string
    order_date: string
    customer_name: string | null
    total_amount: number | null
    scenario: Awaited<ReturnType<typeof this.getFulfillmentScenario>>
  }>> {
    // Get only active orders (not DONE, CANCELLED, or SHIPPED)
    const { data: orders } = await this.supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        order_date,
        customer_name,
        total_amount,
        order_flow_status
      `
      )
      .not("order_flow_status", "in", "('DONE','CANCELLED','SHIPPED')")
      .order("order_date", { ascending: false })

    if (!orders) return []

    // Get scenarios for each order
    const ordersWithScenarios = []
    for (const order of orders) {
      const scenario = await this.getFulfillmentScenario(order.id)
      ordersWithScenarios.push({
        order_id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        scenario
      })
    }

    return ordersWithScenarios
  }

  // Get statistics by fulfillment scenario
  async getFulfillmentStatistics(): Promise<{
    readyToShip: number
    needProduction: number
    needMaterials: number
    inProduction: number
    newOrders: number
    blockedOrders: number
    totalActive: number
  }> {
    const { data: orders } = await this.supabase
      .from("orders")
      .select("order_flow_status")
      .not("order_flow_status", "in", "('DONE','CANCELLED','SHIPPED')")

    const stats = {
      readyToShip: 0,
      needProduction: 0,
      needMaterials: 0,
      inProduction: 0,
      newOrders: 0,
      blockedOrders: 0,
      totalActive: orders?.length || 0
    }

    orders?.forEach(order => {
      switch (order.order_flow_status) {
        case "READY_TO_SHIP": stats.readyToShip++
          break
        case "NEED_PRODUCTION": stats.needProduction++
          break
        case "NEED_MATERIALS": stats.needMaterials++
          break
        case "IN_PRODUCTION": stats.inProduction++
          break
        case "NEW": stats.newOrders++
          break
        case "CANCELLED": stats.blockedOrders++
          break
      }
    })

    return stats
  }
}

export const fulfillmentService = new FulfillmentService()