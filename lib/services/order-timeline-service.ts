import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { OrderFlowStatus } from "@/lib/types/operations"

export class OrderTimelineService {
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

  /**
   * Record a timeline event for an order
   * @param orderId ID of the order
   * @param status New order flow status
   * @param reason Reason for the status change
   * @param additionalData Additional context data
   */
  async recordTimelineEvent(
    orderId: string,
    status: OrderFlowStatus,
    reason: string,
    additionalData: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("order_timeline_events")
        .insert({
          order_id: orderId,
          status,
          reason,
          event_data: additionalData,
          created_at: new Date().toISOString(),
        })

      if (error) {
        console.error("Error recording timeline event:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error in recordTimelineEvent:", error)
      return false
    }
  }

  /**
   * Get timeline events for an order
   * @param orderId ID of the order
   * @returns Array of timeline events sorted by date
   */
  async getOrderTimeline(orderId: string): Promise<Array<{
    id: string
    status: OrderFlowStatus
    reason: string
    event_data: Record<string, any>
    created_at: string
  }>> {
    const { data, error } = await this.supabase
      .from("order_timeline_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error getting order timeline:", error)
      return []
    }

    return data || []
  }

  /**
   * Get current status with reason for an order
   * @param orderId ID of the order
   * @returns Current status and reason
   */
  async getCurrentStatusWithReason(orderId: string): Promise<{
    currentStatus: OrderFlowStatus
    currentReason: string
    timeline: Array<{
      status: OrderFlowStatus
      reason: string
      timestamp: string
    }>
  }> {
    // Get current order status
    const { data: order, error: orderError } = await this.supabase
      .from("orders")
      .select("order_flow_status")
      .eq("id", orderId)
      .maybeSingle()

    if (orderError || !order) {
      return {
        currentStatus: "NEW",
        currentReason: "Заказ не найден",
        timeline: [],
      }
    }

    // Get timeline events
    const timeline = await this.getOrderTimeline(orderId)

    // Get most recent reason for current status
    const currentTimelineEvents = timeline.filter(event => event.status === order.order_flow_status)
    const currentReason = currentTimelineEvents.length > 0 
      ? currentTimelineEvents[currentTimelineEvents.length - 1].reason
      : this.getDefaultReasonForStatus(order.order_flow_status)

    return {
      currentStatus: order.order_flow_status,
      currentReason,
      timeline: timeline.map(event => ({
        status: event.status,
        reason: event.reason,
        timestamp: event.created_at,
      })),
    }
  }

  /**
   * Get default reason for a status
   * @param status Order flow status
   * @returns Default reason text
   */
  private getDefaultReasonForStatus(status: OrderFlowStatus): string {
    const reasons: Record<OrderFlowStatus, string> = {
      "NEW": "Заказ получен и ожидает обработки",
      "NEED_PRODUCTION": "Товар нужно произвести, материалы доступны",
      "NEED_MATERIALS": "Не хватает материалов для производства",
      "IN_PRODUCTION": "Товар находится в производстве",
      "READY_TO_SHIP": "Товар на складе, готов к отправке",
      "SHIPPED": "Товар отправлен клиенту",
      "DONE": "Заказ успешно завершён",
      "CANCELLED": "Заказ был отменён"
    }
    return reasons[status] || "Ожидает обработки"
  }

  /**
   * Automatically record status changes when order_flow_status is updated
   * This would typically be called from a database trigger
   */
  async recordStatusChange(
    orderId: string,
    oldStatus: OrderFlowStatus,
    newStatus: OrderFlowStatus
  ): Promise<boolean> {
    // Generate reason based on status transition
    const reason = this.generateTransitionReason(oldStatus, newStatus)

    return this.recordTimelineEvent(orderId, newStatus, reason, {
      previousStatus: oldStatus,
      transition: `${oldStatus} → ${newStatus}`,
    })
  }

  /**
   * Generate reason for status transition
   * @param oldStatus Previous status
   * @param newStatus New status
   * @returns Reason text
   */
  private generateTransitionReason(oldStatus: OrderFlowStatus, newStatus: OrderFlowStatus): string {
    const transitions: Record<string, string> = {
      "NEW_NEED_PRODUCTION": "Заказ требует производства, материалы доступны",
      "NEW_NEED_MATERIALS": "Для производства не хватает материалов",
      "NEED_MATERIALS_NEED_PRODUCTION": "Материалы поступили, можно начинать производство",
      "NEED_PRODUCTION_IN_PRODUCTION": "Производство запущено",
      "IN_PRODUCTION_READY_TO_SHIP": "Производство завершено, товар на складе",
      "READY_TO_SHIP_SHIPPED": "Заказ отправлен клиенту",
      "SHIPPED_DONE": "Заказ доставлен и завершён",
      "NEW_CANCELLED": "Заказ был отменён",
      "NEED_PRODUCTION_CANCELLED": "Заказ был отменён до начала производства",
      "IN_PRODUCTION_CANCELLED": "Производство было отменено"
    }

    const transitionKey = `${oldStatus}_${newStatus}`
    return transitions[transitionKey] || `Статус изменён с ${oldStatus} на ${newStatus}`
  }
}

export const orderTimelineService = new OrderTimelineService()
