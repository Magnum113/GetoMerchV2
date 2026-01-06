// Warehouse types for the ERP system

export type WarehouseType = "HOME" | "PRODUCTION_CENTER"

export interface Warehouse {
  id: string
  name: string
  type: WarehouseType
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WarehouseWithAvailability {
  warehouse_id: string
  warehouse_name: string
  warehouse_type: WarehouseType
  quantity: number
  available_quantity: number
}

export const WAREHOUSE_TYPES: Record<WarehouseType, { label: string; description: string; color: string }> = {
  HOME: {
    label: "Домашний склад",
    description: "Основной склад для хранения заготовок и готовой продукции",
    color: "bg-blue-100 text-blue-800",
  },
  PRODUCTION_CENTER: {
    label: "Склад вышивки/печати",
    description: "Производственный склад только для заготовок",
    color: "bg-purple-100 text-purple-800",
  },
}

export function getWarehouseLabel(type: WarehouseType): string {
  return WAREHOUSE_TYPES[type]?.label || type
}

export function getWarehouseDescription(type: WarehouseType): string {
  return WAREHOUSE_TYPES[type]?.description || ""
}

export function getWarehouseColor(type: WarehouseType): string {
  return WAREHOUSE_TYPES[type]?.color || "bg-gray-100 text-gray-800"
}
