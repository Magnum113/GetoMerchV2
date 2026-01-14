import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { MaterialDefinition, MaterialLot } from "@/lib/types/database"

export class MaterialAllocationService {
  private supabase

  constructor() {
    // Initialize supabase client only when needed to avoid cookie scope issues
    this.supabase = null
  }

  private async getSupabaseClient() {
    if (!this.supabase) {
      this.supabase = createServerClient(
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
    }
    return this.supabase
  }

  /**
   * Get available material lots for a material definition, sorted by FIFO and warehouse priority
   * @param materialDefinitionId ID of the material definition
   * @returns Array of available lots sorted by priority
   */
  async getAvailableLotsForMaterial(materialDefinitionId: string): Promise<MaterialLot[]> {
    const supabase = await this.getSupabaseClient()
    const { data: lots, error } = await supabase
      .from("material_lots")
      .select(
        `
        *,
        warehouses(name, type)
      `
      )
      .eq("material_definition_id", materialDefinitionId)
      .eq("quantity", ">", 0)
      .order("purchase_date", { ascending: true }) // FIFO: oldest first
      .order("warehouse_id", { ascending: true }) // HOME warehouse first

    if (error) {
      console.error("Error getting material lots:", error)
      return []
    }

    return lots || []
  }

  /**
   * Allocate materials for production based on recipe requirements
   * @param recipeId ID of the recipe
   * @param quantity Number of units to produce
   * @returns Allocation result with success status and details
   */
  async allocateMaterialsForProduction(recipeId: string, quantity: number): Promise<{
    success: boolean
    allocations: Array<{
      materialDefinitionId: string
      materialName: string
      allocatedQuantity: number
      lotsUsed: Array<{
        lotId: string
        quantityUsed: number
        warehouse: string
      }>
    }>
    missingMaterials: Array<{
      materialDefinitionId: string
      materialName: string
      required: number
      available: number
      shortage: number
    }>
  }> {
    const supabase = await this.getSupabaseClient()
    // Get recipe materials
    const { data: recipeMaterials, error: recipeError } = await supabase
      .from("recipe_materials")
      .select(
        `
        material_definition_id,
        quantity_required,
        material_definitions(name, unit)
      `
      )
      .eq("recipe_id", recipeId)

    if (recipeError || !recipeMaterials) {
      console.error("Error getting recipe materials:", recipeError)
      return {
        success: false,
        allocations: [],
        missingMaterials: [],
      }
    }

    const allocations: any[] = []
    const missingMaterials: any[] = []

    // Process each material requirement
    for (const rm of recipeMaterials) {
      const materialDefinitionId = rm.material_definition_id
      const requiredQuantity = rm.quantity_required * quantity
      const materialName = rm.material_definitions?.name || "Unknown"

      if (!materialDefinitionId) {
        missingMaterials.push({
          materialDefinitionId: "unknown",
          materialName,
          required: requiredQuantity,
          available: 0,
          shortage: requiredQuantity,
        })
        continue
      }

      // Get available lots for this material
      const availableLots = await this.getAvailableLotsForMaterial(materialDefinitionId)
      let allocatedQuantity = 0
      const lotsUsed: any[] = []

      // Allocate from available lots (FIFO and warehouse priority)
      for (const lot of availableLots) {
        if (allocatedQuantity >= requiredQuantity) break

        const availableInLot = lot.quantity
        const neededFromLot = requiredQuantity - allocatedQuantity
        const quantityToAllocate = Math.min(availableInLot, neededFromLot)

        if (quantityToAllocate > 0) {
          lotsUsed.push({
            lotId: lot.id,
            quantityUsed: quantityToAllocate,
            warehouse: lot.warehouses?.name || "Unknown",
          })
          allocatedQuantity += quantityToAllocate
        }
      }

      if (allocatedQuantity >= requiredQuantity) {
        // Successfully allocated
        allocations.push({
          materialDefinitionId,
          materialName,
          allocatedQuantity,
          lotsUsed,
        })
      } else {
        // Missing materials
        missingMaterials.push({
          materialDefinitionId,
          materialName,
          required: requiredQuantity,
          available: allocatedQuantity,
          shortage: requiredQuantity - allocatedQuantity,
        })
      }
    }

    return {
      success: missingMaterials.length === 0,
      allocations,
      missingMaterials,
    }
  }

  /**
   * Automatically select the best lot for a material requirement
   * @param materialDefinitionId ID of the material definition
   * @param requiredQuantity Quantity needed
   * @returns Best lot or null if not available
   */
  async getBestLotForRequirement(
    materialDefinitionId: string,
    requiredQuantity: number
  ): Promise<MaterialLot | null> {
    const availableLots = await this.getAvailableLotsForMaterial(materialDefinitionId)

    // Find first lot with sufficient quantity
    for (const lot of availableLots) {
      if (lot.quantity >= requiredQuantity) {
        return lot
      }
    }

    return null
  }

  /**
   * Get total available quantity for a material definition across all warehouses
   * @param materialDefinitionId ID of the material definition
   * @returns Total available quantity
   */
  async getTotalAvailableQuantity(materialDefinitionId: string): Promise<number> {
    const supabase = await this.getSupabaseClient()
    const { data: lots, error } = await supabase
      .from("material_lots")
      .select("quantity")
      .eq("material_definition_id", materialDefinitionId)

    if (error || !lots) {
      return 0
    }

    return lots.reduce((sum, lot) => sum + lot.quantity, 0)
  }

  /**
   * Reserve materials for a production task
   * @param allocations Allocation details from allocateMaterialsForProduction
   * @param productionTaskId ID of the production task
   * @returns Success status
   */
  async reserveMaterials(
    allocations: Array<{
      materialDefinitionId: string
      allocatedQuantity: number
      lotsUsed: Array<{
        lotId: string
        quantityUsed: number
      }>
    }>,
    productionTaskId: string
  ): Promise<boolean> {
    try {
      const supabase = await this.getSupabaseClient()
      // Create material reservations
      for (const allocation of allocations) {
        for (const lotUsed of allocation.lotsUsed) {
          const { error: reservationError } = await supabase
            .from("material_reservations")
            .insert({
              material_lot_id: lotUsed.lotId,
              production_task_id: productionTaskId,
              quantity_reserved: lotUsed.quantityUsed,
              reserved_at: new Date().toISOString(),
            })

          if (reservationError) {
            console.error("Error creating material reservation:", reservationError)
            return false
          }
        }
      }

      return true
    } catch (error) {
      console.error("Error reserving materials:", error)
      return false
    }
  }

  /**
   * Release reserved materials (when production is cancelled or completed)
   * @param productionTaskId ID of the production task
   * @returns Success status
   */
  async releaseReservedMaterials(productionTaskId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabaseClient()
      const { error } = await supabase
        .from("material_reservations")
        .delete()
        .eq("production_task_id", productionTaskId)

      if (error) {
        console.error("Error releasing material reservations:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error releasing materials:", error)
      return false
    }
  }
}

export const materialAllocationService = new MaterialAllocationService()
