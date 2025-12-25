import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OzonClient } from "@/lib/ozon/client"

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const ozonClient = new OzonClient()

    console.log("[v0] Начало синхронизации товаров...")

    const { data: syncLog } = await supabase
      .from("sync_log")
      .insert({
        sync_type: "products",
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    let totalSynced = 0
    let totalEnriched = 0
    let lastId = ""
    let hasMore = true
    let pageCount = 0

    try {
      while (hasMore) {
        pageCount++
        console.log(`[v0] ========== СТРАНИЦА ${pageCount} ==========`)
        console.log(`[v0] Загрузка страницы ${pageCount}, lastId: "${lastId}"`)

        const response = await ozonClient.getProducts(100, lastId)

        if (!response.result?.items) {
          console.error("[v0] ОШИБКА: нет items в ответе /v3/product/list")
          break
        }

        const ozonProducts = response.result.items
        console.log(`[v0] Страница ${pageCount} - получено ${ozonProducts.length} товаров`)

        if (ozonProducts.length === 0) {
          console.log(`[v0] Страница ${pageCount} - больше нет товаров`)
          break
        }

        for (const product of ozonProducts) {
          try {
            const { error } = await supabase.from("products").upsert(
              {
                ozon_product_id: String(product.product_id),
                sku: product.offer_id,
                name: product.offer_id, // Временное имя, обогатим позже
                is_active: !product.archived,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "ozon_product_id" },
            )

            if (error) {
              console.error(`[v0] Ошибка сохранения товара ${product.product_id}:`, error.message)
            } else {
              totalSynced++
            }
          } catch (error) {
            console.error(`[v0] Исключение при сохранении товара ${product.product_id}:`, error)
          }
        }

        console.log(`[v0] Страница ${pageCount} - сохранено ${ozonProducts.length} товаров`)

        const productIds = ozonProducts.map((p: { product_id: number }) => p.product_id)
        const offerIds = ozonProducts.map((p: { offer_id: string }) => p.offer_id)

        console.log(`[v0] Попытка обогатить ${productIds.length} товаров детальной информацией...`)

        // Сначала пытаемся по product_id
        let productDetails = await ozonClient.getProductInfo(productIds)

        let rawItems = productDetails.items || []

        // Если пусто, пытаемся по offer_id
        if (rawItems.length === 0) {
          console.log("[v0] Детали по product_id пусты, пробуем по offer_id...")
          productDetails = await ozonClient.getProductInfo([], offerIds)
          rawItems = productDetails.items || []
        }

        console.log(`[v0] ========== ОБОГАЩЕНИЕ ДЕТАЛЯМИ ==========`)
        console.log(`[v0] rawItems.length (пришло от Ozon):`, rawItems.length)

        // Обогащаем товары детальной информацией
        if (rawItems.length > 0) {
          let matchedCount = 0
          const unmatchedExamples: Array<{ offer_id: string; name: string }> = []

          for (const detail of rawItems) {
            try {
              const { data: existingProduct, error: findError } = await supabase
                .from("products")
                .select("id, sku")
                .eq("sku", detail.offer_id)
                .single()

              if (findError || !existingProduct) {
                if (unmatchedExamples.length < 3) {
                  unmatchedExamples.push({
                    offer_id: detail.offer_id || "N/A",
                    name: detail.name || "N/A",
                  })
                }
                continue
              }

              const updateData: any = {
                last_synced_at: new Date().toISOString(),
              }

              // Название - всегда используем из Ozon, если есть
              if (detail.name) {
                updateData.name = detail.name
              }

              // Категория - сначала пытаемся найти название в таблице категорий
              if (detail.description_category_id) {
                const { data: categoryData } = await supabase
                  .from("ozon_categories")
                  .select("category_name")
                  .eq("category_id", detail.description_category_id)
                  .maybeSingle()

                if (categoryData?.category_name) {
                  updateData.category = categoryData.category_name
                } else {
                  // Если название не найдено, сохраняем ID для последующей синхронизации
                  updateData.category = `ID: ${detail.description_category_id}`
                }
              }

              // Текущая цена (после скидки) - приоритет: price > min_price
              if (detail.price) {
                updateData.price = Number.parseFloat(detail.price)
              } else if (detail.min_price) {
                updateData.price = Number.parseFloat(detail.min_price)
              }

              // Старая цена (до скидки) - сохраняем old_price отдельно
              if (detail.old_price) {
                updateData.price_old = Number.parseFloat(detail.old_price)
              }

              // Валюта - используем currency_code
              if (detail.currency_code) {
                updateData.currency = detail.currency_code
              }

              // Изображение - берём первое из массива images
              if (detail.images && detail.images.length > 0) {
                updateData.image_url = detail.images[0]
              }

              if (matchedCount < 3) {
                console.log(`[v0] Пример обогащения товара #${matchedCount + 1}:`, {
                  offer_id: detail.offer_id,
                  price: detail.price || null,
                  old_price: detail.old_price || null,
                  min_price: detail.min_price || null,
                  saved_price_current: updateData.price || null,
                  saved_price_old: updateData.price_old || null,
                })
              }

              const { error: updateError } = await supabase
                .from("products")
                .update(updateData)
                .eq("sku", detail.offer_id)

              if (updateError) {
                console.error(`[v0] Ошибка обновления товара ${detail.offer_id}:`, updateError.message)
              } else {
                matchedCount++
                totalEnriched++
              }
            } catch (error) {
              console.error(`[v0] Исключение при обогащении товара ${detail.offer_id}:`, error)
            }
          }

          console.log(`[v0] matchedItems.length (обновлено в БД):`, matchedCount)
          console.log(`[v0] Страница ${pageCount} - обогащено ${matchedCount} из ${rawItems.length} товаров`)

          if (unmatchedExamples.length > 0) {
            console.log(`[v0] Примеры несопоставленных товаров (не найдены в БД):`)
            unmatchedExamples.forEach((item, idx) => {
              console.log(`[v0]   ${idx + 1}. offer_id: "${item.offer_id}", name: "${item.name}"`)
            })
          }
        } else {
          console.log(`[v0] Страница ${pageCount} - не удалось получить детальную информацию`)
        }

        lastId = response.result.last_id
        hasMore = ozonProducts.length === 100 && lastId && lastId !== ""
        console.log(`[v0] Страница ${pageCount} - следующая страница: ${hasMore}`)
      }

      const syncTime = Date.now() - startTime

      console.log("[v0] ========== СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА ==========")
      console.log("[v0] Всего сохранено:", totalSynced)
      console.log("[v0] Обогащено деталями:", totalEnriched)
      console.log("[v0] Страниц обработано:", pageCount)
      console.log("[v0] Время выполнения:", `${syncTime}ms`)

      await supabase
        .from("sync_log")
        .update({
          status: "success",
          items_synced: totalSynced,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog?.id)

      return NextResponse.json({
        success: true,
        items_synced: totalSynced,
        items_enriched: totalEnriched,
        pages: pageCount,
        time_ms: syncTime,
      })
    } catch (error) {
      const syncTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"

      console.error("[v0] Синхронизация провалилась:", {
        error: errorMessage,
        time: `${syncTime}ms`,
        totalSynced,
        totalEnriched,
      })

      await supabase
        .from("sync_log")
        .update({
          status: "error",
          error_message: errorMessage,
          items_synced: totalSynced,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog?.id)

      throw error
    }
  } catch (error) {
    console.error("[v0] Ошибка синхронизации товаров:", error)

    const errorMessage = error instanceof Error ? error.message : "Ошибка синхронизации товаров"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
