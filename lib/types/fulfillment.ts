export type FulfillmentType = "PENDING" | "READY_STOCK" | "PRODUCE_ON_DEMAND" | "FBO"
export type FulfillmentStatus = "planned" | "in_production" | "ready" | "shipped" | "cancelled"
export type FulfillmentSource = "HOME" | "OZON_FBS" | "OZON_FBO" | "PRODUCTION"

export interface OrderItemWithFulfillment {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price: number
  reservation_applied: boolean
  fulfillment_type: FulfillmentType
  fulfillment_status: FulfillmentStatus
  fulfillment_source?: FulfillmentSource
  fulfillment_notes?: string
  fulfillment_decided_at?: string
  production_queue_id?: string
  created_at: string
}

export interface FulfillmentEvent {
  id: string
  order_item_id: string
  event_type:
    | "scenario_decided"
    | "production_created"
    | "materials_reserved"
    | "production_started"
    | "production_completed"
    | "ready_for_shipping"
  event_data?: Record<string, any>
  created_at: string
  created_by?: string
}

export interface FulfillmentDecision {
  type: FulfillmentType
  source: FulfillmentSource
  canFulfill: boolean
  reason: string
  availableStock?: number
  requiredQuantity: number
  needsProduction: boolean
  hasMaterials?: boolean
  missingMaterials?: Array<{
    material_id: string
    name: string
    required: number
    available: number
    shortage: number
  }>
}
