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
      <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Операционный центр</h1>
              <p className="text-gray-600">Ежедневный план: что отправить, произвести и заказать</p>
            </div>
            <Button
              onClick={handleRecalculateStatus}
              disabled={recalculating}
              variant="outline"
              className="gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
              {recalculating ? "Пересчитываю..." : "Пересчитать статусы"}
            </Button>
          </div>
        </div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* БЛОК 1: К отправке сегодня */}
          <Card className="lg:col-span-2 border-0 shadow-soft">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-green-100/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">К отправке сегодня</CardTitle>
                    <p className="text-xs text-gray-600 mt-0.5">Заказы готовые к отгрузке</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-green-600">{readyToShip.length}</span>
                  <p className="text-xs text-gray-500 mt-0.5">заказов</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {readyToShip.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Нет заказов готовых к отправке</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {readyToShip.map((order) => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-all hover:border-green-200"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">{order.order_number}</p>
                        <p className="text-sm text-gray-600 mb-3">{order.customer_name}</p>
                        <div className="space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                              <span className="text-gray-700">
                                {item.product_name} <span className="text-gray-500">x{item.quantity}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 ml-4">
                        <p className="font-bold text-lg text-gray-900">{order.total_amount}₽</p>
                        <Button
                          size="sm"
                          onClick={() => handleShipOrder(order.id)}
                          className="bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md transition-all font-medium"
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
          <Card className="border-0 shadow-soft">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-blue-100/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Нужно произвести</CardTitle>
                    <p className="text-xs text-gray-600 mt-0.5">Материалы есть</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{productionNeeds.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {productionNeeds.reduce((sum, p) => sum + p.orders_count, 0)} заказов
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {productionNeeds.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Нет заказов, готовых к производству</p>
                  <p className="text-xs text-gray-400 mt-1">Проверьте блок "Не хватает материалов" ниже</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productionNeeds.map((task, idx) => (
                    <div
                      key={idx}
                      className={`p-4 border rounded-xl transition-all hover:shadow-sm ${
                        task.priority === "high" 
                          ? "border-red-200 bg-red-50/50 hover:bg-red-50" 
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">{task.product_name}</p>
                        {task.priority === "high" && (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3 font-medium">
                        {task.quantity} шт • {task.orders_count} {task.orders_count === 1 ? "заказ" : "заказов"}
                      </p>
                      {task.order_numbers && task.order_numbers.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Заказы:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {task.order_numbers.slice(0, 5).map((orderNum, orderIdx) => (
                              <Badge key={orderIdx} variant="outline" className="text-xs border-gray-300 bg-gray-50">
                                {orderNum}
                              </Badge>
                            ))}
                            {task.order_numbers.length > 5 && (
                              <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50">
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
                        className="w-full border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 font-medium"
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
            <Card className="border-0 shadow-soft border-l-4 border-l-orange-500">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-100/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-orange-900">Не хватает материалов</CardTitle>
                      <p className="text-xs text-orange-700 mt-0.5">Заказы заблокированы</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">{blockedByMaterials.length}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {blockedByMaterials.reduce((sum, p) => sum + p.orders_count, 0)} заказов
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {blockedByMaterials.map((task, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-orange-200 rounded-xl bg-orange-50/30 hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-orange-900">{task.product_name}</p>
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      </div>
                      <p className="text-sm text-gray-700 mb-3 font-medium">
                        {task.quantity} шт • {task.orders_count} {task.orders_count === 1 ? "заказ" : "заказов"} заблокировано
                      </p>
                      {task.order_numbers && task.order_numbers.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-600 mb-1.5 font-medium">Заказы:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {task.order_numbers.slice(0, 5).map((orderNum, orderIdx) => (
                              <Badge key={orderIdx} variant="outline" className="text-xs border-orange-300 bg-white">
                                {orderNum}
                              </Badge>
                            ))}
                            {task.order_numbers.length > 5 && (
                              <Badge variant="outline" className="text-xs border-orange-300 bg-white">
                                +{task.order_numbers.length - 5} еще
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg bg-orange-100/50 border border-orange-200 p-2 mt-3">
                        <p className="text-xs text-orange-700 font-medium">
                          ⚠️ Невозможно произвести: недостаточно материалов. См. блок "Чего не хватает" ниже.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* БЛОК 3: Дефицит материалов */}
          <Card className="border-0 shadow-soft">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-amber-100/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Чего не хватает</CardTitle>
                    <p className="text-xs text-gray-600 mt-0.5">Дефицит материалов</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-600">{materialDeficits.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {materialDeficits.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Материалов достаточно</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {materialDeficits.map((deficit, idx) => (
                    <div key={idx} className="p-4 border border-amber-200 bg-amber-50/50 rounded-xl hover:bg-amber-50 transition-colors">
                      <p className="font-semibold text-gray-900 mb-3">{deficit.material_name}</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Нужно:</span>
                          <span className="font-semibold text-gray-900">{deficit.needed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Есть:</span>
                          <span className="font-semibold text-gray-900">{deficit.have}</span>
                        </div>
                        <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                          <span className="text-gray-700 font-medium">Дефицит:</span>
                          <span className="font-bold text-red-600">
                            {deficit.deficit} {deficit.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* БЛОК 4: Что заказать */}
          <Card className="border-0 shadow-soft">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-red-50 to-red-100/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Заявка на пополнение</CardTitle>
                    <p className="text-xs text-gray-600 mt-0.5">Срочные заказы</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-600">{replenishmentNeeds.length}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {replenishmentNeeds.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium">Ничего срочно не требуется</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {replenishmentNeeds.map((item, idx) => (
                    <div key={idx} className="p-4 border border-red-200 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">{item.material_name}</p>
                        {item.priority === "high" && (
                          <Badge variant="destructive" className="text-xs">СРОЧНО</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 font-medium">
                        {item.quantity_needed} {item.unit}
                      </p>
                    </div>
                  ))}
                  <Button 
                    size="sm" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md transition-all font-medium mt-4"
                  >
                    Создать заявку на пополнение
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 font-medium">
              Последнее обновление: <span className="text-gray-900">{new Date().toLocaleTimeString("ru-RU")}</span>
            </p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500">Все данные актуальны в реальном времени</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
