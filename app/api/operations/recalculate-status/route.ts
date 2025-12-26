import { NextResponse } from "next/server"
import { operationsService } from "@/lib/services/operations-service"

export async function POST() {
  try {
    console.log("[v0] API: Запускаю пересчет операционных статусов...")

    await operationsService.updateAllOrdersOperationalStatus()

    return NextResponse.json({
      success: true,
      message: "Операционные статусы пересчитаны",
    })
  } catch (error: any) {
    console.error("[v0] Ошибка пересчета статусов:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
