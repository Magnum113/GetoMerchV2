import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Package, Clock, CheckCircle, XCircle, Warehouse, Factory } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SyncOrdersButton } from "@/components/orders/sync-orders-button"
import Link from "next/link"

export default async function OrdersPage() {
  const supabase = await createClient()

  console.log("[v0] OrdersPage: Fetching orders from database...")

  // Fetch orders with items and fulfillment info
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items(
        *,
        products(*),
        production_queue!order_items_production_queue_id_fkey(status)
      )
    `,
    )
    .order("order_date", { ascending: false })

  console.log("[v0] OrdersPage: Query result", {
    ordersCount: orders?.length || 0,
    hasError: !!ordersError,
    error: ordersError?.message,
    firstOrder: orders?.[0]
      ? {
          id: orders[0].id,
          order_number: orders[0].order_number,
          status: orders[0].status,
        }
      : null,
  })

  // Get last sync info
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("*")
    .eq("sync_type", "orders")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Calculate statistics
  const totalOrders = orders?.length || 0
  const awaitingPackaging = orders?.filter((o) => o.status === "awaiting_packaging").length || 0
  const awaitingDeliver = orders?.filter((o) => o.status === "awaiting_deliver").length || 0
  const delivered = orders?.filter((o) => o.status === "delivered").length || 0
  const totalRevenue =
    orders?.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount?.toString() || "0") || 0), 0) || 0

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awaiting_packaging":
        return <Clock className="h-4 w-4" />
      case "awaiting_deliver":
        return <Package className="h-4 w-4" />
      case "delivered":
        return <CheckCircle className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "delivered":
        return "default"
      case "awaiting_packaging":
        return "secondary"
      case "awaiting_deliver":
        return "outline"
      case "cancelled":
        return "destructive"
      default:
        return "secondary"
    }
  }

  // Helper for getting fulfillment badge
  const getFulfillmentBadge = (type: string | null) => {
    switch (type) {
      case "READY_STOCK":
        return (
          <Badge variant="default" className="bg-emerald-100 text-emerald-900 gap-1">
            <Warehouse className="h-3 w-3" />
            Со склада
          </Badge>
        )
      case "PRODUCE_ON_DEMAND":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-900 gap-1">
            <Factory className="h-3 w-3" />
            Производство
          </Badge>
        )
      case "FBO":
        return (
          <Badge variant="default" className="bg-purple-100 text-purple-900 gap-1">
            <Package className="h-3 w-3" />
            FBO
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидает
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Заказы</h1>
          <p className="text-gray-600">Управление заказами с маркетплейса Ozon</p>
        </div>
        <SyncOrdersButton />
      </div>

      {/* Statistics Cards - Улучшенный дизайн */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden">
          <CardHeader className="pb-3 pt-3 bg-gradient-to-br from-gray-50 to-gray-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Всего заказов</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden">
          <CardHeader className="pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ожидают упаковки</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">{awaitingPackaging}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden">
          <CardHeader className="pb-3 pt-3 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ожидают отправки</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{awaitingDeliver}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden">
          <CardHeader className="pb-3 pt-3 bg-gradient-to-br from-green-50 to-green-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Доставлено</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">{delivered}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden">
          <CardHeader className="pb-3 pt-3 bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Общая выручка</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{Math.round(totalRevenue).toLocaleString('ru-RU')} ₽</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {lastSync && (
        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Последняя синхронизация</CardTitle>
                <CardDescription className="text-sm">
                  {lastSync.completed_at ? formatDate(lastSync.completed_at) : "Выполняется"}
                </CardDescription>
              </div>
              <Badge
                variant={
                  lastSync.status === "success" ? "default" : lastSync.status === "error" ? "destructive" : "secondary"
                }
                className="font-medium"
              >
                {lastSync.status === "success" ? "Успешно" : lastSync.status === "error" ? "Ошибка" : lastSync.status}
              </Badge>
            </div>
          </CardHeader>
          {lastSync.status === "success" && lastSync.items_synced !== null && (
            <CardContent className="pt-4">
              <p className="text-sm text-gray-600 font-medium">Синхронизировано заказов: <span className="font-bold text-gray-900">{lastSync.items_synced}</span></p>
            </CardContent>
          )}
          {lastSync.status === "error" && lastSync.error_message && (
            <CardContent className="pt-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700 font-medium">{lastSync.error_message}</p>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Orders Table */}
      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Все заказы</CardTitle>
              <CardDescription className="text-sm">Заказы с маркетплейса Ozon с информацией о fulfillment</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Поиск заказов..." 
                className="pl-10 h-10 bg-gray-50/80 border-gray-200 rounded-lg focus:bg-white focus:border-primary/50" 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-700">Номер заказа</TableHead>
                  <TableHead className="font-semibold text-gray-700">Клиент</TableHead>
                  <TableHead className="font-semibold text-gray-700">Статус</TableHead>
                  <TableHead className="font-semibold text-gray-700">Товаров</TableHead>
                  <TableHead className="font-semibold text-gray-700">Исполнение</TableHead>
                  <TableHead className="font-semibold text-gray-700">Сумма</TableHead>
                  <TableHead className="font-semibold text-gray-700">Дата заказа</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders && orders.length > 0 ? (
                  orders.map((order) => {
                    const itemCount = order.order_items?.length || 0
                    const fulfillmentTypes = {
                      readyStock: order.order_items?.filter((i) => i.fulfillment_type === "READY_STOCK").length || 0,
                      produce: order.order_items?.filter((i) => i.fulfillment_type === "PRODUCE_ON_DEMAND").length || 0,
                      fbo: order.order_items?.filter((i) => i.fulfillment_type === "FBO").length || 0,
                      pending: order.order_items?.filter((i) => i.fulfillment_type === "PENDING").length || 0,
                    }

                    return (
                      <TableRow 
                        key={order.id}
                        className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                      >
                        <TableCell className="py-4">
                          <div>
                            <div className="font-semibold text-gray-900">{order.order_number}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">ID: {order.ozon_order_id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm text-gray-700">{order.customer_name || "—"}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <Badge 
                              variant={getStatusVariant(order.status)}
                              className="font-medium"
                            >
                              {order.status === "awaiting_packaging"
                                ? "Ожидает упаковки"
                                : order.status === "awaiting_deliver"
                                  ? "Ожидает отправки"
                                  : order.status === "delivered"
                                    ? "Доставлен"
                                    : order.status === "cancelled"
                                      ? "Отменён"
                                      : order.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm font-semibold text-gray-900">
                            {itemCount} {itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {fulfillmentTypes.readyStock > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                              >
                                <Warehouse className="h-3 w-3 mr-1" />
                                {fulfillmentTypes.readyStock}
                              </Badge>
                            )}
                            {fulfillmentTypes.produce > 0 && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-medium">
                                <Factory className="h-3 w-3 mr-1" />
                                {fulfillmentTypes.produce}
                              </Badge>
                            )}
                            {fulfillmentTypes.fbo > 0 && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 font-medium">
                                <Package className="h-3 w-3 mr-1" />
                                {fulfillmentTypes.fbo}
                              </Badge>
                            )}
                            {fulfillmentTypes.pending > 0 && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-medium">
                                <Clock className="h-3 w-3 mr-1" />
                                {fulfillmentTypes.pending}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-bold text-gray-900">
                            {Math.round(Number.parseFloat(order.total_amount?.toString() || "0")).toLocaleString('ru-RU')} ₽
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600">{formatDate(order.order_date)}</span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" className="font-medium hover:bg-primary/10 hover:text-primary">
                              Подробнее
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <ShoppingCart className="h-12 w-12 text-gray-300" />
                        <p className="text-sm text-gray-500 font-medium">Заказов не найдено</p>
                        <p className="text-xs text-gray-400">Нажмите &quot;Синхронизировать заказы&quot; для импорта с Ozon</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
