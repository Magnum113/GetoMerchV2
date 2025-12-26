"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Package, Truck, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ShipReadyOrder, ProductionNeeds, MaterialDeficit, ReplenishmentItem } from "@/lib/types/operations"

export default function OperationsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [readyToShip, setReadyToShip] = useState<ShipReadyOrder[]>([])
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeeds[]>([])
  const [blockedByMaterials, setBlockedByMaterials] = useState<ProductionNeeds[]>([])
  const [materialDeficits, setMaterialDeficits] = useState<MaterialDeficit[]>([])
  const [replenishmentNeeds, setReplenishmentNeeds] = useState<ReplenishmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    loadOperationsData()
  }, [])

  const loadOperationsData = async () => {
    setLoading(true)
    console.log("[v0] Загружаю данные операций...")

    try {
      // БЛОК 1: Заказы готовые к отправке
      console.log("[v0] Запрос заказов с operational_status = READY_TO_SHIP...")
      const { data: shipReady, error: shipError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_name,
          total_amount,
          operational_status,
          order_items(
            quantity,
            products(name)
          )
        `,
        )
        .eq("operational_status", "READY_TO_SHIP")
        .eq("warehouse_type", "FBS")

      console.log("[v0] Результат READY_TO_SHIP:", {
        count: shipReady?.length || 0,
        error: shipError,
        sample: shipReady?.[0],
      })

      if (shipReady) {
        setReadyToShip(
          shipReady.map((o: any) => ({
            id: o.id,
            order_number: o.order_number,
            customer_name: o.customer_name,
            total_amount: o.total_amount,
            items: o.order_items.map((i: any) => ({
              product_name: i.products.name,
              quantity: i.quantity,
            })),
          })),
        )
      }

      // БЛОК 2: Агрегированные производственные потребности (только те, у которых есть материалы)
      console.log("[v0] Запрос заказов с operational_status = WAITING_FOR_PRODUCTION или IN_PRODUCTION...")
      const { data: ordersReady, error: prodError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          operational_status,
          order_items(
            product_id,
            quantity,
            products(name)
          )
        `,
        )
        .in("operational_status", ["WAITING_FOR_PRODUCTION", "IN_PRODUCTION"])

      console.log("[v0] Результат WAITING_FOR_PRODUCTION:", {
        count: ordersReady?.length || 0,
        error: prodError,
        sample: ordersReady?.[0],
      })

      if (ordersReady) {
        const aggregated = new Map<
          string,
          { name: string; qty: number; count: number; order_numbers: string[] }
        >()
        ordersReady.forEach((o: any) => {
          o.order_items.forEach((i: any) => {
            const existing = aggregated.get(i.product_id)
            if (existing) {
              existing.qty += i.quantity
              existing.count += 1
              if (!existing.order_numbers.includes(o.order_number)) {
                existing.order_numbers.push(o.order_number)
              }
            } else {
              aggregated.set(i.product_id, {
                name: i.products.name,
                qty: i.quantity,
                count: 1,
                order_numbers: [o.order_number],
              })
            }
          })
        })

        setProductionNeeds(
          Array.from(aggregated.values()).map((p) => ({
            product_name: p.name,
            quantity: p.qty,
            orders_count: p.count,
            order_numbers: p.order_numbers,
            priority: p.qty > 5 ? "high" : "normal",
          })),
        )
      }

      // БЛОК 2.5: Заказы, заблокированные из-за недостатка материалов
      console.log("[v0] Запрос заказов с operational_status = WAITING_FOR_MATERIALS...")
      const { data: ordersBlocked, error: blockedError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          operational_status,
          order_items(
            product_id,
            quantity,
            products(name)
          )
        `,
        )
        .eq("operational_status", "WAITING_FOR_MATERIALS")

      console.log("[v0] Результат WAITING_FOR_MATERIALS:", {
        count: ordersBlocked?.length || 0,
        error: blockedError,
        sample: ordersBlocked?.[0],
      })

      if (ordersBlocked) {
        const aggregatedBlocked = new Map<
          string,
          { name: string; qty: number; count: number; order_numbers: string[] }
        >()
        ordersBlocked.forEach((o: any) => {
          o.order_items.forEach((i: any) => {
            const existing = aggregatedBlocked.get(i.product_id)
            if (existing) {
              existing.qty += i.quantity
              existing.count += 1
              if (!existing.order_numbers.includes(o.order_number)) {
                existing.order_numbers.push(o.order_number)
              }
            } else {
              aggregatedBlocked.set(i.product_id, {
                name: i.products.name,
                qty: i.quantity,
                count: 1,
                order_numbers: [o.order_number],
              })
            }
          })
        })

        setBlockedByMaterials(
          Array.from(aggregatedBlocked.values()).map((p) => ({
            product_name: p.name,
            quantity: p.qty,
            orders_count: p.count,
            order_numbers: p.order_numbers,
            priority: "high" as const,
          })),
        )
      }

      console.log("[v0] Запрос ВСЕХ заказов для диагностики...")
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, order_number, operational_status, warehouse_type")
        .limit(5)

      console.log("[v0] Примеры всех заказов:", allOrders)

      // БЛОК 3 & 4: Дефицит материалов и пополнение
      console.log("[v0] Запрос дефицита материалов...")
      try {
        const deficitsResponse = await fetch("/api/operations/get-deficits")
        const deficitsData = await deficitsResponse.json()

        if (deficitsData.success) {
          console.log("[v0] Дефицит материалов получен:", {
            deficits: deficitsData.deficits?.length || 0,
            replenishment: deficitsData.replenishment?.length || 0,
          })
          setMaterialDeficits(deficitsData.deficits || [])
          setReplenishmentNeeds(deficitsData.replenishment || [])
        } else {
          console.error("[v0] Ошибка получения дефицита:", deficitsData.error)
          setMaterialDeficits([])
          setReplenishmentNeeds([])
        }
      } catch (deficitsError) {
        console.error("[v0] Ошибка при запросе дефицита:", deficitsError)
        setMaterialDeficits([])
        setReplenishmentNeeds([])
      }
    } catch (error) {
      console.error("[v0] Ошибка загрузки операций:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleShipOrder = async (orderId: string) => {
    console.log("[v0] Отправляю заказ:", orderId)
    // TODO: API call для отправки заказа
    await loadOperationsData()
  }

  const handleStartProduction = async (productName: string) => {
    console.log("[v0] Запускаю производство для:", productName)
    // TODO: API call для запуска производства
    await loadOperationsData()
  }

  const handleRecalculateStatus = async () => {
    setRecalculating(true)
    console.log("[v0] Запускаю пересчет операционных статусов...")

    try {
      const response = await fetch("/api/operations/recalculate-status", {
        method: "POST",
      })

      const result = await response.json()

      if (result.success) {
        console.log("[v0] Пересчет завершен успешно")
        // Перезагружаем данные
        await loadOperationsData()
      } else {
        console.error("[v0] Ошибка пересчета:", result.error)
      }
    } catch (error) {
      console.error("[v0] Ошибка при вызове API пересчета:", error)
    } finally {
      setRecalculating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Операционный центр</h1>
              <p className="text-muted-foreground">Ежедневный план: что отправить, произвести и заказать</p>
            </div>
            <Button
              onClick={handleRecalculateStatus}
              disabled={recalculating}
              variant="outline"
              className="gap-2 bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
              {recalculating ? "Пересчитываю..." : "Пересчитать статусы"}
            </Button>
          </div>
        </div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* БЛОК 1: К отправке сегодня */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-green-600" />
                  <CardTitle>К отправке сегодня</CardTitle>
                </div>
                <span className="text-2xl font-bold text-green-600">{readyToShip.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {readyToShip.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">Нет заказов готовых к отправке</p>
              ) : (
                <div className="space-y-4">
                  {readyToShip.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                        <div className="mt-2 space-y-1">
                          {order.items.map((item, idx) => (
                            <p key={idx} className="text-sm">
                              {item.product_name} x{item.quantity}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-semibold">{order.total_amount}₽</p>
                        <Button
                          size="sm"
                          onClick={() => handleShipOrder(order.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Отправлено
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* БЛОК 2: Нужно произвести (материалы есть) */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <CardTitle>Нужно произвести</CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{productionNeeds.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {productionNeeds.reduce((sum, p) => sum + p.orders_count, 0)} заказов (материалы есть)
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {productionNeeds.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  Нет заказов, готовых к производству. Проверьте блок "Не хватает материалов" ниже.
                </p>
              ) : (
                <div className="space-y-3">
                  {productionNeeds.map((task, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border rounded-lg ${
                        task.priority === "high" ? "border-red-300 bg-red-50" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{task.product_name}</p>
                        {task.priority === "high" && <AlertTriangle className="w-4 h-4 text-red-600" />}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {task.quantity} шт • {task.orders_count} {task.orders_count === 1 ? "заказ" : "заказов"}
                      </p>
                      {task.order_numbers && task.order_numbers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Заказы:</p>
                          <div className="flex flex-wrap gap-1">
                            {task.order_numbers.slice(0, 5).map((orderNum, orderIdx) => (
                              <Badge key={orderIdx} variant="outline" className="text-xs">
                                {orderNum}
                              </Badge>
                            ))}
                            {task.order_numbers.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{task.order_numbers.length - 5} еще
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartProduction(task.product_name)}
                        className="w-full"
                      >
                        Запустить производство
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* БЛОК 2.5: Заблокировано из-за недостатка материалов */}
          {blockedByMaterials.length > 0 && (
            <Card className="border-orange-300 bg-orange-50/50">
              <CardHeader className="border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <CardTitle className="text-orange-700">Не хватает материалов</CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">{blockedByMaterials.length}</div>
                    <div className="text-xs text-muted-foreground">
                      {blockedByMaterials.reduce((sum, p) => sum + p.orders_count, 0)} заказов заблокировано
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {blockedByMaterials.map((task, idx) => (
                    <div
                      key={idx}
                      className="p-3 border border-orange-300 rounded-lg bg-white"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-orange-900">{task.product_name}</p>
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {task.quantity} шт • {task.orders_count} {task.orders_count === 1 ? "заказ" : "заказов"} заблокировано
                      </p>
                      {task.order_numbers && task.order_numbers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Заказы:</p>
                          <div className="flex flex-wrap gap-1">
                            {task.order_numbers.slice(0, 5).map((orderNum, orderIdx) => (
                              <Badge key={orderIdx} variant="outline" className="text-xs border-orange-300">
                                {orderNum}
                              </Badge>
                            ))}
                            {task.order_numbers.length > 5 && (
                              <Badge variant="outline" className="text-xs border-orange-300">
                                +{task.order_numbers.length - 5} еще
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-orange-600 mt-2">
                        ⚠️ Невозможно произвести: недостаточно материалов. См. блок "Чего не хватает" ниже.
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* БЛОК 3: Дефицит материалов */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <CardTitle>Чего не хватает</CardTitle>
                </div>
                <span className="text-2xl font-bold text-orange-600">{materialDeficits.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {materialDeficits.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  Материалов достаточно
                </p>
              ) : (
                <div className="space-y-3">
                  {materialDeficits.map((deficit, idx) => (
                    <div key={idx} className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                      <p className="font-medium">{deficit.material_name}</p>
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Нужно: {deficit.needed}</p>
                        <p>Есть: {deficit.have}</p>
                        <p className="font-semibold text-red-600">
                          Дефицит: {deficit.deficit} {deficit.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* БЛОК 4: Что заказать */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <CardTitle>Заявка на пополнение</CardTitle>
                </div>
                <span className="text-2xl font-bold text-red-600">{replenishmentNeeds.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {replenishmentNeeds.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">Ничего срочно не требуется</p>
              ) : (
                <div className="space-y-3">
                  {replenishmentNeeds.map((item, idx) => (
                    <div key={idx} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                      <p className="font-medium">{item.material_name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.quantity_needed} {item.unit}
                      </p>
                      {item.priority === "high" && <p className="text-sm font-semibold text-red-600 mt-2">СРОЧНО</p>}
                    </div>
                  ))}
                  <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 mt-4">
                    Создать заявку на пополнение
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Последнее обновление: {new Date().toLocaleTimeString("ru-RU")} • Все данные актуальны в реальном времени
          </p>
        </div>
      </div>
    </main>
  )
}
