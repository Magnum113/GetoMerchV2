import { NextResponse } from "next/server"
import { OzonClient } from "@/lib/ozon/client"

export async function POST() {
  try {
    const ozonClient = new OzonClient()

    console.log("[v0] Testing Ozon API connection...")

    const response = await ozonClient.getProducts(10, "")

    const diagnosticInfo = {
      success: true,
      apiCallSuccessful: true,
      responseKeys: Object.keys(response),
      hasResult: !!response.result,
      resultKeys: response.result ? Object.keys(response.result) : [],
      itemsReturned: response.result?.items?.length || 0,
      lastId: response.result?.last_id || null,
      sampleData:
        response.result?.items && response.result.items.length > 0
          ? JSON.stringify(response.result.items[0]).substring(0, 500)
          : "No items returned",
      fullResponseSnippet: JSON.stringify(response).substring(0, 2000),
    }

    console.log("[v0] Diagnostic info:", diagnosticInfo)

    return NextResponse.json(diagnosticInfo)
  } catch (error) {
    console.error("[v0] Test API failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"

    return NextResponse.json(
      {
        success: false,
        apiCallSuccessful: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? error.stack?.substring(0, 1000) : null,
      },
      { status: 500 },
    )
  }
}
