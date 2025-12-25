import { type NextRequest, NextResponse } from "next/server"
import { OzonClient } from "@/lib/ozon/client"

export async function POST(request: NextRequest) {
  try {
    const ozonClient = new OzonClient()

    console.log("[v0] Тест product/info/list на 1 товар")

    // Получаем первый товар из списка
    const listResponse = await ozonClient.getProducts(1, "")

    if (!listResponse.result?.items || listResponse.result.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Не удалось получить список товаров",
      })
    }

    const firstProduct = listResponse.result.items[0]
    console.log("[v0] Первый товар:", firstProduct)

    // Пытаемся получить детали по product_id
    console.log("[v0] Попытка #1: запрос по product_id")
    let detailsResponse = await ozonClient.getProductInfo([firstProduct.product_id])

    const result: {
      product: typeof firstProduct
      detailsByProductId: unknown
      detailsByOfferId?: unknown
      success: boolean
    } = {
      product: firstProduct,
      detailsByProductId: detailsResponse.result,
      success: false,
    }

    if (detailsResponse.result?.items && detailsResponse.result.items.length > 0) {
      console.log("[v0] Успех по product_id!")
      result.success = true
    } else {
      // Fallback на offer_id
      console.log("[v0] Попытка #2: запрос по offer_id")
      detailsResponse = await ozonClient.getProductInfo([], [firstProduct.offer_id])
      result.detailsByOfferId = detailsResponse.result

      if (detailsResponse.result?.items && detailsResponse.result.items.length > 0) {
        console.log("[v0] Успех по offer_id!")
        result.success = true
      } else {
        console.log("[v0] Оба способа не дали результата")
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Ошибка теста product/info/list:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
