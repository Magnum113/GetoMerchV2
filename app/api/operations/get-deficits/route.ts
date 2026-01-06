import { NextResponse } from "next/server"
import { operationsService } from "@/lib/services/operations-service"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    console.log("[v0] API: Получаю дефицит материалов...")

    const supabase = await createClient()
    operationsService.setSupabaseClient(supabase)
    
    const deficits = await operationsService.getMaterialDeficits()
    const replenishment = await operationsService.getReplenishmentNeeds()

    return NextResponse.json({
      success: true,
      deficits,
      replenishment,
    })
  } catch (error: any) {
    console.error("[v0] Ошибка получения дефицита:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

