// Операционные типы для управления ежедневной работой

export type ProductType = "FINISHED_GOOD" | "BLANK_MATERIAL"
export type OperationalStatus =
  | "PENDING"
  | "READY_TO_SHIP"
  | "WAITING_FOR_PRODUCTION"
  | "IN_PRODUCTION"
  | "WAITING_FOR_MATERIALS"
  | "BLOCKED"
  | "SHIPPED"
  | "DONE"

export type OrderFlowStatus =
  | "NEW" 
  | "NEED_PRODUCTION" 
  | "NEED_MATERIALS" 
  | "IN_PRODUCTION" 
  | "READY_TO_SHIP" 
  | "SHIPPED" 
  | "DONE" 
  | "CANCELLED"

export interface OperationTask {
  id: string
  product_id: string
  task_type: "PRODUCE" | "REPLENISH_BLANKS" | "REPLENISH_MATERIALS"
  quantity_needed: number
  quantity_completed: number
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "normal" | "low"
  related_orders: string[] // массив order_ids
  materials_reserved: boolean
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyOperations {
  id: string
  operation_date: string
  total_orders_to_ship: number
  orders_ready_to_ship: number
  production_tasks_total: number
  materials_deficit: Record<string, { needed: number; have: number }>
  replenishment_requests_needed: number
  last_calculated_at: string
  created_at: string
}

export interface ShipReadyOrder {
  id: string
  order_number: string
  customer_name: string
  total_amount: number
  items: Array<{
    product_name: string
    quantity: number
  }>
}

export interface ProductionNeeds {
  product_name: string
  quantity: number
  orders_count: number
  order_numbers?: string[]
  priority: "high" | "normal" | "low"
}

export interface MaterialDeficit {
  material_name: string
  needed: number
  have: number
  deficit: number
  unit: string
}

export interface ReplenishmentItem {
  material_name: string
  quantity_needed: number
  unit: string
  priority: "high" | "normal"
}
