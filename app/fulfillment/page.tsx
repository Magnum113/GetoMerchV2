import { createClient } from "@/lib/supabase/server"
import { ArrowRight, Package, Factory, Warehouse, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { fulfillmentService } from "@/lib/services/fulfillment-service"

export default async function FulfillmentPage() {
  const supabase = await createClient()

  // Use the new fulfillment service to get active orders and statistics
  const fulfillmentStats = await fulfillmentService.getFulfillmentStatistics()
  const ordersWithScenarios = await fulfillmentService.getActiveOrdersWithScenarios()

  // Get production queue for production stats
  const { data: productionQueue } = await supabase.from("production_queue").select(
    `
      *,
      product:products(name, sku),
      order:orders(order_number)
    `
  )

  const productionStats = {
    pending: productionQueue?.filter((p) => p.status === "pending").length || 0,
    inProgress: productionQueue?.filter((p) => p.status === "in_progress").length || 0,
    completed: productionQueue?.filter((p) => p.status === "completed").length || 0,
  }

  // Calculate fulfillment rate based on order flow status
  const totalActiveOrders = fulfillmentStats.totalActive
  const fulfilledOrders = fulfillmentStats.readyToShip + productionStats.completed
  const fulfillmentRate = totalActiveOrders > 0 ? Math.round((fulfilledOrders / totalActiveOrders) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Заголовок */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Fulfillment Flow</h1>
          <p className="text-slate-600">Контроль исполнения заказов в реальном времени</p>
        </div>

        {/* Основные метрики */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Готовы к отправке</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{fulfillmentStats.readyToShip}</div>
                  <p className="text-xs text-slate-500 mt-1">Заказы со склада</p>
                </div>
                <Warehouse className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Требует производства</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{fulfillmentStats.needProduction}</div>
                  <p className="text-xs text-slate-500 mt-1">Материалы доступны</p>
                </div>
                <Factory className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Ожидает материалов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{fulfillmentStats.needMaterials}</div>
                  <p className="text-xs text-slate-500 mt-1">Требует закупки</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">В производстве</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{fulfillmentStats.inProduction}</div>
                  <p className="text-xs text-slate-500 mt-1">Активные задачи</p>
                </div>
                <Factory className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Коэффициент исполнения */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Коэффициент исполнения
            </CardTitle>
            <CardDescription>Процент заказов готовых к отгрузке или отгруженных</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Исполнено {fulfilledOrders} из {totalActiveOrders} заказов
                </span>
                <span className="font-bold text-slate-900">{fulfillmentRate}%</span>
              </div>
              <Progress value={fulfillmentRate} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Визуальный поток */}
        <Card className="shadow-md bg-gradient-to-r from-slate-50 to-white">
          <CardHeader>
            <CardTitle>Путь заказа</CardTitle>
            <CardDescription>Визуализация процесса исполнения</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 py-6">
              {/* Заказ получен */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-3 ring-4 ring-blue-50">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="font-semibold text-slate-900 mb-1">Заказ получен</div>
                <div className="text-xs text-slate-500">Синхронизация с Ozon</div>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-400 flex-shrink-0" />

              {/* Сценарий определен */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3 ring-4 ring-emerald-50">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="font-semibold text-slate-900 mb-1">Сценарий выбран</div>
                <div className="text-xs text-slate-500">Автоматическое решение</div>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-400 flex-shrink-0" />

              {/* Исполнение */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 ring-4 ring-purple-50">
                  <Factory className="h-8 w-8 text-purple-600" />
                </div>
                <div className="font-semibold text-slate-900 mb-1">Исполнение</div>
                <div className="text-xs text-slate-500">Склад или производство</div>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-400 flex-shrink-0" />

              {/* Готов к отгрузке */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-3 ring-4 ring-amber-50">
                  <Warehouse className="h-8 w-8 text-amber-600" />
                </div>
                <div className="font-semibold text-slate-900 mb-1">Готов</div>
                <div className="text-xs text-slate-500">Ожидает отгрузки</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Очередь производства */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-blue-600" />
                Очередь производства
              </CardTitle>
              <CardDescription>Текущее состояние задач производства</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-900">Ожидают запуска</div>
                  <div className="text-sm text-slate-600">Готовы к производству</div>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-lg px-4 py-1">
                  {productionStats.pending}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-900">В работе</div>
                  <div className="text-sm text-slate-600">Активное производство</div>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-900 text-lg px-4 py-1">
                  {productionStats.inProgress}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-900">Завершено</div>
                  <div className="text-sm text-slate-600">Готовы к отгрузке</div>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 text-lg px-4 py-1">
                  {productionStats.completed}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Активные заказы по сценариям */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                Активные заказы
              </CardTitle>
              <CardDescription>Все заказы требующие действий</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersWithScenarios.length > 0 ? (
                <div className="space-y-3">
                  {ordersWithScenarios.slice(0, 5).map((order) => (
                    <div
                      key={order.order_id}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <Package className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">Заказ: {order.order_number}</div>
                        <div className="text-sm text-slate-600">Статус: {order.scenario.reason}</div>
                        <Badge variant="outline" className={`mt-1 text-xs ${
                          order.scenario.canProceed ? 'border-green-300 text-green-700' : 'border-orange-300 text-orange-700'
                        }`}>
                          {order.scenario.action}
                        </Badge>
                        {!order.scenario.canProceed && order.scenario.missingMaterials && (
                          <div className="mt-2 text-xs text-red-600">
                            Не хватает: {order.scenario.missingMaterials.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {ordersWithScenarios.length > 5 && (
                    <div className="text-center text-sm text-slate-500 pt-2">
                      И еще {ordersWithScenarios.length - 5} заказов...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                  <div className="font-medium">Все заказы обработаны</div>
                  <div className="text-sm">Нет активных заказов требующих действий</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Последние события */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Последние действия системы</CardTitle>
            <CardDescription>Автоматические решения и события fulfillment flow</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentEventsTable />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function RecentEventsTable() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from("fulfillment_events")
    .select(
      `
      *,
      order_item:order_items!inner(
        order:orders(order_number),
        product:products(name, sku)
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10)

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="h-12 w-12 mx-auto mb-2 text-slate-400" />
        <div>Пока нет событий</div>
        <div className="text-sm">События появятся после синхронизации заказов</div>
      </div>
    )
  }

  const eventTypeLabels: Record<string, { label: string; color: string }> = {
    scenario_decided: { label: "Сценарий выбран", color: "bg-blue-100 text-blue-900" },
    production_created: { label: "Производство создано", color: "bg-purple-100 text-purple-900" },
    materials_reserved: { label: "Материалы зарезервированы", color: "bg-emerald-100 text-emerald-900" },
    production_started: { label: "Производство запущено", color: "bg-amber-100 text-amber-900" },
    production_completed: { label: "Производство завершено", color: "bg-green-100 text-green-900" },
    ready_for_shipping: { label: "Готов к отгрузке", color: "bg-teal-100 text-teal-900" },
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const eventType = eventTypeLabels[event.event_type] || {
          label: event.event_type,
          color: "bg-slate-100 text-slate-900",
        }
        const createdAt = new Date(event.created_at)
        const timeAgo = getTimeAgo(createdAt)

        return (
          <div
            key={event.id}
            className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${eventType.color} text-xs`}>{eventType.label}</Badge>
                <span className="text-xs text-slate-500">{timeAgo}</span>
              </div>
              <div className="text-sm font-medium text-slate-900">{event.order_item?.product?.name}</div>
              <div className="text-xs text-slate-600">Заказ: {event.order_item?.order?.order_number}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "только что"
  if (diffMins < 60) return `${diffMins} мин назад`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} ч назад`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} дн назад`
}

