import { createClient } from "@/lib/supabase/server"
import { ArrowRight, Package, Factory, Warehouse, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default async function FulfillmentPage() {
  const supabase = await createClient()

  // Загружаем статистику по сценариям исполнения
  const { data: orderItems } = await supabase.from("order_items").select(`
      *,
      order:orders!inner(status, order_number, order_date),
      product:products(name, sku)
    `)

  const { data: productionQueue } = await supabase.from("production_queue").select(`
      *,
      product:products(name, sku),
      order:orders(order_number)
    `)

  // Подсчет статистики
  const stats = {
    readyStock: orderItems?.filter((i) => i.fulfillment_type === "READY_STOCK").length || 0,
    produceOnDemand: orderItems?.filter((i) => i.fulfillment_type === "PRODUCE_ON_DEMAND").length || 0,
    fbo: orderItems?.filter((i) => i.fulfillment_type === "FBO").length || 0,
    pending: orderItems?.filter((i) => i.fulfillment_type === "PENDING").length || 0,
  }

  const productionStats = {
    pending: productionQueue?.filter((p) => p.status === "pending").length || 0,
    inProgress: productionQueue?.filter((p) => p.status === "in_progress").length || 0,
    completed: productionQueue?.filter((p) => p.status === "completed").length || 0,
  }

  // Заказы ожидающие материалы
  const { data: waitingMaterials } = await supabase
    .from("order_items")
    .select(`
      *,
      order:orders(order_number, order_date),
      product:products(name, sku)
    `)
    .eq("fulfillment_type", "PRODUCE_ON_DEMAND")
    .eq("fulfillment_status", "planned")

  const totalItems = orderItems?.length || 0
  const fulfilledItems =
    orderItems?.filter((i) => i.fulfillment_status === "ready" || i.fulfillment_status === "shipped").length || 0
  const fulfillmentRate = totalItems > 0 ? Math.round((fulfilledItems / totalItems) * 100) : 0

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
              <CardTitle className="text-sm font-medium text-slate-600">Со склада</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{stats.readyStock}</div>
                  <p className="text-xs text-slate-500 mt-1">Готовы к отгрузке</p>
                </div>
                <Warehouse className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">В производстве</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{stats.produceOnDemand}</div>
                  <p className="text-xs text-slate-500 mt-1">Требуется изготовление</p>
                </div>
                <Factory className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">FBO (Ozon)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{stats.fbo}</div>
                  <p className="text-xs text-slate-500 mt-1">Исполняет Ozon</p>
                </div>
                <Package className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Ожидают</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{stats.pending}</div>
                  <p className="text-xs text-slate-500 mt-1">Сценарий не определен</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
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
                  Исполнено {fulfilledItems} из {totalItems} позиций
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

          {/* Узкие места */}
          <Card className="shadow-md border-l-4 border-l-rose-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-900">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                Требуют внимания
              </CardTitle>
              <CardDescription>Заказы ожидающие материалы</CardDescription>
            </CardHeader>
            <CardContent>
              {waitingMaterials && waitingMaterials.length > 0 ? (
                <div className="space-y-3">
                  {waitingMaterials.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100"
                    >
                      <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{item.product?.name}</div>
                        <div className="text-sm text-slate-600">Заказ: {item.order?.order_number}</div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          Недостаточно материалов
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {waitingMaterials.length > 5 && (
                    <div className="text-center text-sm text-slate-500 pt-2">
                      И еще {waitingMaterials.length - 5} позиций...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                  <div className="font-medium">Все в порядке</div>
                  <div className="text-sm">Нет заказов ожидающих материалы</div>
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
