"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Package, Truck, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ShipReadyOrder, ProductionNeeds, MaterialDeficit, ReplenishmentItem } from "@/lib/types/operations"
import FocusedOperationsScreen from "@/components/operations/focused-operations-screen"

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
      // БЛОК 1: Заказы готовые к отправке (используем новый order_flow_status)
      console.log("[v0] Запрос заказов с order_flow_status = READY_TO_SHIP...")
      const { data: shipReady, error: shipError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_name,
          total_amount,
          order_flow_status,
          operational_status,
          order_items(
            quantity,
            products(name)
          )
        `,
        )
        .eq("order_flow_status", "READY_TO_SHIP")
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

      // БЛОК 2: Агрегированные производственные потребности (используем новый order_flow_status)
      console.log("[v0] Запрос заказов с order_flow_status = NEED_PRODUCTION или IN_PRODUCTION...")
      const { data: ordersReady, error: prodError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          order_flow_status,
          operational_status,
          order_items(
            product_id,
            quantity,
            products(name)
          )
        `,
        )
        .in("order_flow_status", ["NEED_PRODUCTION", "IN_PRODUCTION"])

      console.log("[v0] Результат NEED_PRODUCTION:", {
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

      // БЛОК 2.5: Заказы, заблокированные из-за недостатка материалов (используем новый order_flow_status)
      console.log("[v0] Запрос заказов с order_flow_status = NEED_MATERIALS...")
      const { data: ordersBlocked, error: blockedError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          order_flow_status,
          operational_status,
          order_items(
            product_id,
            quantity,
            products(name)
          )
        `,
        )
        .eq("order_flow_status", "NEED_MATERIALS")

      console.log("[v0] Результат NEED_MATERIALS:", {
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

  // Use the new focused operations screen
  return <FocusedOperationsScreen />
}
