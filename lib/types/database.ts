export type Product = {
  id: string
  ozon_product_id: string
  sku: string
  name: string
  category: string | null
  price: number | null
  image_url: string | null
  is_active: boolean
  last_synced_at: string
  created_at: string
  updated_at: string
}

export type Inventory = {
  id: string
  product_id: string
  warehouse_location: string | null
  quantity_in_stock: number
  quantity_reserved: number
  min_stock_level: number
  last_updated_at: string
  created_at: string
}

export type Material = {
  id: string
  name: string
  sku: string
  unit: string
  quantity_in_stock: number
  min_stock_level: number
  cost_per_unit: number | null
  supplier: string | null
  created_at: string
  updated_at: string
}

export type Recipe = {
  id: string
  product_id: string
  name: string
  description: string | null
  production_time_minutes: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RecipeMaterial = {
  id: string
  recipe_id: string
  material_id: string
  quantity_needed: number
  created_at: string
}

export type Order = {
  id: string
  ozon_order_id: string
  order_number: string
  status: string
  customer_name: string | null
  total_amount: number | null
  order_date: string
  delivery_date: string | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  quantity: number
  price: number
  created_at: string
}

export type ProductionQueue = {
  id: string
  product_id: string
  quantity: number
  priority: string
  status: string
  order_id: string | null
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ReplenishmentRequest = {
  id: string
  material_id: string
  quantity_needed: number
  status: string
  priority: string
  requested_at: string
  ordered_at: string | null
  received_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SyncLog = {
  id: string
  sync_type: string
  status: string
  items_synced: number | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}
