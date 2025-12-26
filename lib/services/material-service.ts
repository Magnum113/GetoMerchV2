import { createClient } from "@/lib/supabase/server"

export type MaterialDefinition = {
  id: string
  name: string
  type: "blank" | "consumable" | "packaging"
  attributes: {
    size?: string
    material_type?: string
    color?: string
    [key: string]: any
  }
  unit: string
}

export type MaterialLot = {
  id: string
  material_definition_id: string
  supplier_name: string | null
  cost_per_unit: number
  quantity: number
  warehouse_id: string
  received_at: string
}

export type MaterialAvailability = {
  material_definition_id: string
  material_name: string
  total_quantity: number
  available_quantity: number
  lot_count: number
  avg_cost_per_unit: number
}

export type MaterialReservation = {
  material_lot_id: string
  quantity: number
  cost_per_unit: number
  supplier_name: string | null
}

export class MaterialService {
  private supabase

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Получить доступное количество материала по определению
   */
  async getAvailableQuantity(materialDefinitionId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc("get_material_definition_available_quantity", {
      def_id: materialDefinitionId,
    })

    if (error) {
      console.error("[v0] Ошибка получения доступного количества:", error)
      return 0
    }

    return Number.parseFloat(data || 0)
  }

  /**
   * Получить все доступные партии материала по FIFO
   */
  async getAvailableLots(
    materialDefinitionId: string,
    requiredQuantity: number,
  ): Promise<MaterialLot[]> {
    const { data: lots, error } = await this.supabase
      .from("material_lots")
      .select("*")
      .eq("material_definition_id", materialDefinitionId)
      .order("received_at", { ascending: true }) // FIFO: старые партии первыми

    if (error) {
      console.error("[v0] Ошибка получения партий:", error)
      return []
    }

    // Фильтруем партии с доступным количеством
    const availableLots: MaterialLot[] = []
    for (const lot of lots || []) {
      const available = await this.getLotAvailableQuantity(lot.id)
      if (available > 0) {
        availableLots.push({
          ...lot,
          quantity: available,
        })
      }
    }

    return availableLots
  }

  /**
   * Получить доступное количество конкретной партии
   */
  async getLotAvailableQuantity(lotId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc("get_material_lot_available_quantity", {
      lot_id: lotId,
    })

    if (error) {
      console.error("[v0] Ошибка получения доступного количества партии:", error)
      return 0
    }

    return Number.parseFloat(data || 0)
  }

  /**
   * Зарезервировать материалы для производства (FIFO)
   * Возвращает список резерваций с конкретными партиями
   */
  async reserveMaterialsForProduction(
    recipeId: string,
    quantity: number,
  ): Promise<{
    success: boolean
    reservations: MaterialReservation[]
    missingMaterials: Array<{ material_definition_id: string; name: string; required: number; available: number }>
  }> {
    // Получаем рецепт с материалами
    const { data: recipe, error: recipeError } = await this.supabase
      .from("recipes")
      .select(
        `
        id,
        recipe_materials(
          material_definition_id,
          quantity_required,
          material_definitions(id, name, unit)
        )
      `,
      )
      .eq("id", recipeId)
      .single()

    if (recipeError || !recipe) {
      return {
        success: false,
        reservations: [],
        missingMaterials: [],
      }
    }

    const reservations: MaterialReservation[] = []
    const missingMaterials: Array<{
      material_definition_id: string
      name: string
      required: number
      available: number
    }> = []

    // Для каждого материала в рецепте
    for (const rm of recipe.recipe_materials || []) {
      const materialDef = rm.material_definitions
      if (!materialDef || !rm.material_definition_id) continue

      const requiredQuantity = Number.parseFloat(rm.quantity_required || 0) * quantity
      const availableQuantity = await this.getAvailableQuantity(rm.material_definition_id)

      if (availableQuantity < requiredQuantity) {
        missingMaterials.push({
          material_definition_id: rm.material_definition_id,
          name: materialDef.name,
          required: requiredQuantity,
          available: availableQuantity,
        })
        continue
      }

      // Получаем партии по FIFO
      const lots = await this.getAvailableLots(rm.material_definition_id, requiredQuantity)
      let remaining = requiredQuantity

      for (const lot of lots) {
        if (remaining <= 0) break

        const lotAvailable = await this.getLotAvailableQuantity(lot.id)
        const toReserve = Math.min(remaining, lotAvailable)

        if (toReserve > 0) {
          reservations.push({
            material_lot_id: lot.id,
            quantity: toReserve,
            cost_per_unit: Number.parseFloat(lot.cost_per_unit || 0),
            supplier_name: lot.supplier_name,
          })
          remaining -= toReserve
        }
      }

      if (remaining > 0) {
        missingMaterials.push({
          material_definition_id: rm.material_definition_id,
          name: materialDef.name,
          required: requiredQuantity,
          available: availableQuantity - (requiredQuantity - remaining),
        })
      }
    }

    return {
      success: missingMaterials.length === 0,
      reservations,
      missingMaterials,
    }
  }

  /**
   * Списать материалы из партий (создать движения)
   */
  async consumeMaterials(
    reservations: MaterialReservation[],
    productionId: string,
    reason: string = "production",
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const movements = reservations.map((res) => ({
        material_lot_id: res.material_lot_id,
        production_id: productionId,
        quantity_change: -res.quantity, // Отрицательное значение = списание
        reason,
        notes: `Автоматическое списание по FIFO. Поставщик: ${res.supplier_name || "не указан"}`,
      }))

      const { error } = await this.supabase.from("material_movements").insert(movements)

      if (error) {
        console.error("[v0] Ошибка создания движений материалов:", error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("[v0] Ошибка списания материалов:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      }
    }
  }

  /**
   * Получить себестоимость производства на основе резерваций
   */
  calculateProductionCost(reservations: MaterialReservation[]): number {
    return reservations.reduce((total, res) => {
      return total + res.quantity * res.cost_per_unit
    }, 0)
  }

  /**
   * Получить детали использованных материалов для производства
   */
  async getProductionMaterialDetails(productionId: string): Promise<
    Array<{
      material_definition_name: string
      lot_id: string
      quantity: number
      cost_per_unit: number
      supplier_name: string | null
      total_cost: number
    }>
  > {
    const { data: movements, error } = await this.supabase
      .from("material_movements")
      .select(
        `
        material_lot_id,
        quantity_change,
        material_lots(
          id,
          supplier_name,
          cost_per_unit,
          material_definition_id,
          material_definitions(name)
        )
      `,
      )
      .eq("production_id", productionId)
      .lt("quantity_change", 0) // Только списания

    if (error || !movements) {
      console.error("[v0] Ошибка получения деталей материалов:", error)
      return []
    }

    return movements.map((mov) => {
      const lot = mov.material_lots as any
      const def = lot?.material_definitions as any
      const quantity = Math.abs(Number.parseFloat(mov.quantity_change || 0))
      const costPerUnit = Number.parseFloat(lot?.cost_per_unit || 0)

      return {
        material_definition_name: def?.name || "Неизвестно",
        lot_id: mov.material_lot_id,
        quantity,
        cost_per_unit: costPerUnit,
        supplier_name: lot?.supplier_name || null,
        total_cost: quantity * costPerUnit,
      }
    })
  }
}

export const materialService = new MaterialService()

