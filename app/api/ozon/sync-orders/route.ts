import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OzonClient } from "@/lib/ozon/client"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const ozonClient = new OzonClient()

    let itemsSynced = 0
    let itemsSaved = 0
    let itemsSkippedNoProduct = 0
    let itemsReserved = 0
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
          items_saved: 0,
          items_skipped_no_product: 0,
          items_reserved: 0,
          errors_count: 0,
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

      const productCache = new Map<string, { id: number }>()
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

          const { data: dbOrder, error: orderError } = await supabase
            .from("orders")
            .upsert(
              {
                ozon_order_id: order.posting_number,
                order_number: order.order_number || order.posting_number,
                status: order.status,
                warehouse_type: "FBS",
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
            if (orderError.code === "PGRST204" || orderError.message.includes("warehouse_type")) {
              console.error(
                `[v0] КРИТИЧЕСКАЯ ОШИБКА: Колонка warehouse_type не найдена в таблице orders. Необходимо выполнить миграцию: scripts/008_add_warehouse_type_to_orders.sql`,
              )
            }
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
                .select("id, reservation_applied")
                .eq("order_id", dbOrder.id)
                .eq("product_id", dbProduct.id)
                .maybeSingle()

              if (existingItem) {
                const { error: updateError } = await supabase
                  .from("order_items")
                  .update({
                    quantity: itemData.quantity,
                    price: itemData.unit_price,
                  })
                  .eq("id", existingItem.id)

                if (updateError) {
                  console.error(
                    `[v0] Ошибка обновления товара ${itemData.offer_id} для заказа ${order.posting_number}:`,
                    updateError.message,
                  )
                  errorsCount++
                  continue
                }
              } else {
                const { error: insertError } = await supabase.from("order_items").insert({
                  order_id: dbOrder.id,
                  product_id: dbProduct.id,
                  quantity: itemData.quantity,
                  price: itemData.unit_price,
                  reservation_applied: false,
                })

                if (insertError) {
                  console.error(
                    `[v0] Ошибка создания товара ${itemData.offer_id} для заказа ${order.posting_number}:`,
                    insertError.message,
                  )
                  errorsCount++
                  continue
                }
              }

              itemsSaved++

              // Резервирование инвентаря
              if (order.status === "awaiting_packaging" || order.status === "awaiting_deliver") {
                const itemReservationStatus = existingItem?.reservation_applied ?? false

                if (itemReservationStatus) {
                  continue
                }

                const warehouseLocation = "HOME"
                const { data: inventory, error: invError } = await supabase
                  .from("inventory")
                  .select("*")
                  .eq("product_id", dbProduct.id)
                  .eq("warehouse_location", warehouseLocation)
                  .maybeSingle()

                if (invError) {
                  console.error(`[v0] Ошибка поиска инвентаря для ${itemData.offer_id}:`, invError.message)
                  errorsCount++
                  continue
                }

                if (!inventory) {
                  const { error: createError } = await supabase.from("inventory").insert({
                    product_id: dbProduct.id,
                    warehouse_location: warehouseLocation,
                    quantity_in_stock: 0,
                    quantity_reserved: itemData.quantity,
                    min_stock_level: 0,
                    last_updated_at: new Date().toISOString(),
                  })

                  if (createError) {
                    console.error(`[v0] Ошибка создания инвентаря для ${itemData.offer_id}:`, createError.message)
                    errorsCount++
                    continue
                  }

                  itemsReserved++
                } else {
                  const { error: updateError } = await supabase
                    .from("inventory")
                    .update({
                      quantity_reserved: inventory.quantity_reserved + itemData.quantity,
                      last_updated_at: new Date().toISOString(),
                    })
                    .eq("id", inventory.id)

                  if (updateError) {
                    console.error(`[v0] Ошибка обновления резерва для ${itemData.offer_id}:`, updateError.message)
                    errorsCount++
                    continue
                  }

                  itemsReserved++
                }

                await supabase
                  .from("order_items")
                  .update({ reservation_applied: true })
                  .eq("order_id", dbOrder.id)
                  .eq("product_id", dbProduct.id)
              }
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

      console.log(`[v0] Синхронизация завершена:`)
      console.log(`  - Заказов получено от Ozon: ${ozonOrders.length}`)
      console.log(`  - Заказов сохранено: ${itemsSynced}`)
      console.log(`  - Товаров сохранено: ${itemsSaved}`)
      console.log(`  - Товаров пропущено (нет в БД): ${itemsSkippedNoProduct}`)
      console.log(`  - Резервов применено: ${itemsReserved}`)
      console.log(`  - Ошибок: ${errorsCount}`)
      console.log(`  - Заказов с нулевой суммой: ${ordersWithZeroTotal}`)
      console.log(`  - Заказов с рассчитанной суммой: ${ordersWithCalculatedTotal}`)

      if (skippedProducts.length > 0) {
        console.log(`  - Пропущенные артикулы (примеры): ${skippedProducts.slice(0, 5).join(", ")}`)
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
        items_reserved: itemsReserved,
        errors_count: errorsCount,
        skipped_products_sample: skippedProducts.slice(0, 10),
        orders_with_zero_total: ordersWithZeroTotal,
        orders_with_calculated_total: ordersWithCalculatedTotal,
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
