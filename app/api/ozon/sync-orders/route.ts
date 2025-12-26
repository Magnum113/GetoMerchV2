import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OzonClient } from "@/lib/ozon/client"
import { FulfillmentService } from "@/lib/services/fulfillment-service"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const ozonClient = new OzonClient()
    const fulfillmentService = new FulfillmentService(supabase)

    let itemsSynced = 0
    let itemsSaved = 0
    let itemsSkippedNoProduct = 0
    let itemsFulfillmentDecided = 0
    let itemsReadyStock = 0
    let itemsProduceOnDemand = 0
    let itemsFBO = 0
    let errorsCount = 0
    const skippedProducts: string[] = []

    let ordersWithZeroTotal = 0
    let ordersWithCalculatedTotal = 0

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from("sync_log")
      .insert({
        sync_type: "orders",
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    try {
      let allOrders: any[] = []
      let offset = 0
      let hasMore = true

      console.log("[v0] Начинаем загрузку заказов с пагинацией...")

      while (hasMore) {
        const ordersResponse = await ozonClient.getOrders(undefined, undefined, undefined, offset)

        if (!ordersResponse.result || !ordersResponse.result.postings) {
          console.log(`[v0] Пагинация: offset=${offset}, получено 0 заказов`)
          break
        }

        const postings = ordersResponse.result.postings
        console.log(`[v0] Пагинация: offset=${offset}, получено ${postings.length} заказов`)

        allOrders = allOrders.concat(postings)
        hasMore = ordersResponse.result.has_next === true && postings.length > 0
        offset += postings.length

        // Защита от бесконечного цикла
        if (offset > 10000) {
          console.warn("[v0] WARNING: Остановка пагинации на 10000 заказах")
          break
        }

        // Небольшая задержка между запросами
        if (hasMore) {
          await sleep(200)
        }
      }

      console.log(`[v0] Загрузка завершена: получено ${allOrders.length} заказов`)

      if (allOrders.length === 0) {
        await supabase
          .from("sync_log")
          .update({
            status: "success",
            items_synced: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog?.id)

        return NextResponse.json({
          success: true,
          items_synced: 0,
        })
      }

      const ozonOrders = allOrders
      console.log(`[v0] Получено ${ozonOrders.length} заказов от Ozon API`)

      if (ozonOrders.length > 0) {
        const sampleOrder = ozonOrders[0]
        console.log("[v0] ========== ДИАГНОСТИКА СТРУКТУРЫ ЗАКАЗА ==========")
        console.log("[v0] Posting number:", sampleOrder.posting_number)
        console.log("[v0] Financial data keys:", Object.keys(sampleOrder.financial_data || {}))
        console.log("[v0] Financial data:", JSON.stringify(sampleOrder.financial_data, null, 2))

        if (sampleOrder.products && sampleOrder.products.length > 0) {
          const sampleProduct = sampleOrder.products[0]
          console.log("[v0] Product keys:", Object.keys(sampleProduct))
          console.log("[v0] Product sample:", {
            offer_id: sampleProduct.offer_id,
            quantity: sampleProduct.quantity,
            price: sampleProduct.price,
            currency_code: sampleProduct.currency_code,
            price_key_exists: "price" in sampleProduct,
            price_value: sampleProduct.price,
            price_type: typeof sampleProduct.price,
          })
        }
        console.log("[v0] ====================================================")
      }

      const allOfferIds = ozonOrders.flatMap((order) => order.products?.map((p) => p.offer_id) || [])
      const uniqueOfferIds = [...new Set(allOfferIds)]

      console.log(`[v0] Предзагрузка ${uniqueOfferIds.length} уникальных товаров из БД...`)
      const { data: allProducts } = await supabase.from("products").select("id, sku").in("sku", uniqueOfferIds)

      const productCache = new Map<string, { id: string }>()
      allProducts?.forEach((p) => productCache.set(p.sku, { id: p.id }))
      console.log(`[v0] Загружено ${productCache.size} товаров в кеш`)

      // Sync orders to database
      for (const order of ozonOrders) {
        try {
          let calculatedTotal = 0
          const orderItemsData: Array<{
            offer_id: string
            quantity: number
            unit_price: number
            line_total: number
          }> = []

          // Сначала обрабатываем товары чтобы получить цены
          for (const product of order.products || []) {
            let unitPrice = 0

            if (product.price && !isNaN(Number.parseFloat(product.price))) {
              unitPrice = Number.parseFloat(product.price)
            } else if (product.unit_price && !isNaN(Number.parseFloat(product.unit_price))) {
              unitPrice = Number.parseFloat(product.unit_price)
            } else if (product.total_price && product.quantity > 0) {
              unitPrice = Number.parseFloat(product.total_price) / product.quantity
            }

            const lineTotal = unitPrice * product.quantity
            calculatedTotal += lineTotal

            orderItemsData.push({
              offer_id: product.offer_id,
              quantity: product.quantity,
              unit_price: unitPrice,
              line_total: lineTotal,
            })

            if (unitPrice === 0) {
              console.log("[v0] WARNING: Не удалось определить цену для товара", {
                posting_number: order.posting_number,
                offer_id: product.offer_id,
                product_keys: Object.keys(product),
              })
            }
          }

          const apiTotal = order.financial_data?.posting_services?.total || 0
          console.log("[v0] Расчет суммы заказа:", {
            posting_number: order.posting_number,
            calculated_total: calculatedTotal,
            api_posting_services_total: apiTotal,
            items_count: orderItemsData.length,
          })

          if (calculatedTotal === 0) {
            ordersWithZeroTotal++
          } else {
            ordersWithCalculatedTotal++
          }

          // Все заказы загруженные через getOrders() являются FBS, так как метод использует /v3/posting/fbs/list
          const orderFulfillmentType = "FBS"

          // Сохраняем заказ
          const { data: dbOrder, error: orderError } = await supabase
            .from("orders")
            .upsert(
              {
                ozon_order_id: order.posting_number,
                order_number: order.order_number || order.posting_number,
                status: order.status,
                warehouse_type: "FBS",
                fulfillment_type: orderFulfillmentType,
                customer_name: order.customer?.name || null,
                total_amount: calculatedTotal,
                order_date: order.in_process_at || order.created_at,
                delivery_date: order.delivering_date || null,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "ozon_order_id" },
            )
            .select()
            .single()

          if (orderError) {
            console.error(`[v0] Ошибка сохранения заказа ${order.posting_number}:`, orderError.message)
            errorsCount++
            continue
          }

          itemsSynced++

          await sleep(100)

          for (const itemData of orderItemsData) {
            try {
              const dbProduct = productCache.get(itemData.offer_id)

              if (!dbProduct) {
                itemsSkippedNoProduct++
                if (!skippedProducts.includes(itemData.offer_id)) {
                  skippedProducts.push(itemData.offer_id)
                }
                console.log(`[v0] Товар ${itemData.offer_id} не найден в БД для заказа ${order.posting_number}`)
                continue
              }

              // Проверяем существует ли уже запись order_item
              const { data: existingItem } = await supabase
                .from("order_items")
                .select("id, fulfillment_type, fulfillment_status")
                .eq("order_id", dbOrder.id)
                .eq("product_id", dbProduct.id)
                .maybeSingle()

              let orderItemId: string

              if (existingItem) {
                // Обновляем существующую позицию
                await supabase
                  .from("order_items")
                  .update({
                    quantity: itemData.quantity,
                    price: itemData.unit_price,
                  })
                  .eq("id", existingItem.id)

                orderItemId = existingItem.id
              } else {
                // Создаем новую позицию
                const { data: newItem, error: insertError } = await supabase
                  .from("order_items")
                  .insert({
                    order_id: dbOrder.id,
                    product_id: dbProduct.id,
                    quantity: itemData.quantity,
                    price: itemData.unit_price,
                    reservation_applied: false,
                    fulfillment_type: "PENDING",
                    fulfillment_status: "planned",
                  })
                  .select()
                  .single()

                if (insertError) {
                  console.error(`[v0] Ошибка создания позиции:`, insertError.message)
                  errorsCount++
                  continue
                }

                orderItemId = newItem.id
              }

              itemsSaved++

              // Пропускаем только определение сценария если он уже определен
              if (existingItem && existingItem.fulfillment_type !== "PENDING") {
                console.log(`[v0] Сценарий для позиции ${orderItemId} уже определен: ${existingItem.fulfillment_type}`)

                // Определяем операционный статус на основе существующего fulfillment_type
                let operationalStatus = "PENDING"

                if (existingItem.fulfillment_type === "READY_STOCK") {
                  operationalStatus = "READY_TO_SHIP"
                } else if (existingItem.fulfillment_type === "PRODUCE_ON_DEMAND") {
                  if (existingItem.fulfillment_status === "planned") {
                    operationalStatus = "WAITING_FOR_PRODUCTION"
                  } else if (existingItem.fulfillment_status === "in_production") {
                    operationalStatus = "IN_PRODUCTION"
                  } else if (existingItem.fulfillment_status === "ready") {
                    operationalStatus = "READY_TO_SHIP"
                  }
                } else if (existingItem.fulfillment_type === "FBO") {
                  operationalStatus = "PENDING"
                }

                // Обновляем операционный статус заказа
                await supabase.from("orders").update({ operational_status: operationalStatus }).eq("id", dbOrder.id)

                console.log(`[v0] Обновлен операционный статус: ${operationalStatus}`)

                continue
              }

              console.log(`[v0] ========== ОПРЕДЕЛЯЕМ СЦЕНАРИЙ ИСПОЛНЕНИЯ ==========`)
              console.log(`[v0] Заказ: ${order.posting_number}`)
              console.log(`[v0] Товар: ${itemData.offer_id}`)
              console.log(`[v0] Количество: ${itemData.quantity}`)
              console.log(`[v0] Тип склада: ${orderFulfillmentType}`)

              // Автоматически определяем сценарий через FulfillmentService
              const decision = await fulfillmentService.decideFulfillmentScenario(
                dbProduct.id,
                itemData.quantity,
                orderFulfillmentType,
              )

              console.log(`[v0] РЕШЕНИЕ:`, decision)

              // Применяем сценарий
              const applied = await fulfillmentService.applyFulfillmentScenario(orderItemId, decision)

              if (!applied) {
                console.error(`[v0] Не удалось применить сценарий для позиции ${orderItemId}`)
                errorsCount++
                continue
              }

              itemsFulfillmentDecided++

              let operationalStatus = "PENDING"

              if (decision.type === "READY_STOCK") {
                operationalStatus = "READY_TO_SHIP"
              } else if (decision.type === "PRODUCE_ON_DEMAND") {
                if (!decision.hasMaterials) {
                  operationalStatus = "WAITING_FOR_MATERIALS"
                } else {
                  operationalStatus = "WAITING_FOR_PRODUCTION"
                }
              } else if (decision.type === "FBO") {
                operationalStatus = "PENDING"
              }

              // Обновляем операционный статус заказа
              await supabase.from("orders").update({ operational_status: operationalStatus }).eq("id", dbOrder.id)

              console.log(`[v0] Установлен операционный статус: ${operationalStatus}`)

              if (decision.type === "READY_STOCK") {
                // Резервируем товар на складе
                const reserved = await fulfillmentService.reserveStock(dbProduct.id, itemData.quantity, orderItemId)

                if (reserved) {
                  itemsReadyStock++
                  console.log(`[v0] ✓ READY_STOCK: товар зарезервирован`)
                } else {
                  console.error(`[v0] ✗ READY_STOCK: не удалось зарезервировать товар`)
                  errorsCount++
                }
              } else if (decision.type === "PRODUCE_ON_DEMAND") {
                if (decision.canFulfill) {
                  const productionId = await fulfillmentService.createProduction(
                    dbProduct.id,
                    itemData.quantity,
                    dbOrder.id,
                    orderItemId,
                    "normal",
                  )

                  if (productionId) {
                    itemsProduceOnDemand++
                    console.log(`[v0] ✓ PRODUCE_ON_DEMAND: производство создано (${productionId})`)

                    if (!decision.hasMaterials) {
                      console.warn(`[v0] ⚠ ВНИМАНИЕ: Недостаточно материалов для производства!`)
                      console.warn(
                        `[v0] Недостающие материалы:`,
                        decision.missingMaterials?.map((m) => `${m.name}: ${m.shortage}`),
                      )
                    }
                  } else {
                    console.error(`[v0] ✗ PRODUCE_ON_DEMAND: не удалось создать производство`)
                    errorsCount++
                  }
                } else {
                  // Нет рецепта - помечаем как невозможно исполнить
                  console.warn(`[v0] ⚠ PRODUCE_ON_DEMAND: ${decision.reason}`)
                  console.warn(`[v0] Заказ требует внимания - нет возможности производства`)
                }
              } else if (decision.type === "FBO") {
                // FBO - ничего не делаем, исполняет Ozon
                itemsFBO++
                console.log(`[v0] ✓ FBO: заказ исполняет Ozon`)
              }

              console.log(`[v0] ====================================================`)
            } catch (productError) {
              console.error(`[v0] Ошибка обработки товара ${itemData.offer_id}:`, productError)
              errorsCount++
            }
          }
        } catch (orderError) {
          console.error(`[v0] Ошибка обработки заказа ${order.posting_number}:`, orderError)
          errorsCount++
        }
      }

      console.log(`[v0] ========== ИТОГИ СИНХРОНИЗАЦИИ ==========`)
      console.log(`  - Заказов получено от Ozon: ${ozonOrders.length}`)
      console.log(`  - Заказов сохранено: ${itemsSynced}`)
      console.log(`  - Товаров сохранено: ${itemsSaved}`)
      console.log(`  - Товаров пропущено (нет в БД): ${itemsSkippedNoProduct}`)
      console.log(`  - Сценариев определено: ${itemsFulfillmentDecided}`)
      console.log(`    • READY_STOCK: ${itemsReadyStock}`)
      console.log(`    • PRODUCE_ON_DEMAND: ${itemsProduceOnDemand}`)
      console.log(`    • FBO: ${itemsFBO}`)
      console.log(`  - Ошибок: ${errorsCount}`)
      console.log(`[v0] ===========================================`)

      if (skippedProducts.length > 0) {
        console.log(`  - Пропущенные артикулы (примеры): ${skippedProducts.slice(0, 5).join(", ")}`)
      }

      // Пересчитываем операционные статусы после синхронизации
      console.log("[v0] Пересчитываю операционные статусы после синхронизации...")
      try {
        const { operationsService } = await import("@/lib/services/operations-service")
        await operationsService.updateAllOrdersOperationalStatus()
        console.log("[v0] ✓ Операционные статусы пересчитаны")
      } catch (statusError) {
        console.error("[v0] Ошибка пересчета статусов:", statusError)
        // Не прерываем процесс, если пересчет не удался
      }

      await supabase
        .from("sync_log")
        .update({
          status: "success",
          items_synced: itemsSynced,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog?.id)

      return NextResponse.json({
        success: true,
        items_synced: itemsSynced,
        items_saved: itemsSaved,
        items_skipped_no_product: itemsSkippedNoProduct,
        fulfillment_decided: itemsFulfillmentDecided,
        ready_stock: itemsReadyStock,
        produce_on_demand: itemsProduceOnDemand,
        fbo: itemsFBO,
        errors_count: errorsCount,
        skipped_products_sample: skippedProducts.slice(0, 10),
      })
    } catch (error) {
      console.error("[v0] Синхронизация заказов упала с ошибкой:", error)

      await supabase
        .from("sync_log")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : "Неизвестная ошибка",
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog?.id)

      throw error
    }
  } catch (error) {
    console.error("[v0] Критическая ошибка синхронизации заказов:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Синхронизация заказов упала",
      },
      { status: 500 },
    )
  }
}
