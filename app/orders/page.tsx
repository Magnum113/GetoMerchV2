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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заказы</h1>
          <p className="text-muted-foreground mt-1">Управление заказами с маркетплейса Ozon</p>
        </div>
        <SyncOrdersButton />
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего заказов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ожидают упаковки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{awaitingPackaging}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ожидают отправки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{awaitingDeliver}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Доставлено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{delivered}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Общая выручка</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalRevenue)} ₽</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {lastSync && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Последняя синхронизация</CardTitle>
                <CardDescription>
                  {lastSync.completed_at ? formatDate(lastSync.completed_at) : "Выполняется"}
                </CardDescription>
              </div>
              <Badge
                variant={
                  lastSync.status === "success" ? "default" : lastSync.status === "error" ? "destructive" : "secondary"
                }
              >
                {lastSync.status === "success" ? "Успешно" : lastSync.status === "error" ? "Ошибка" : lastSync.status}
              </Badge>
            </div>
          </CardHeader>
          {lastSync.status === "success" && lastSync.items_synced !== null && (
            <CardContent>
              <p className="text-sm text-muted-foreground">Синхронизировано заказов: {lastSync.items_synced}</p>
            </CardContent>
          )}
          {lastSync.status === "error" && lastSync.error_message && (
            <CardContent>
              <p className="text-sm text-destructive">{lastSync.error_message}</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Все заказы</CardTitle>
              <CardDescription>Заказы с маркетплейса Ozon с информацией о fulfillment</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Поиск заказов..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер заказа</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Товаров</TableHead>
                <TableHead>Исполнение</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Дата заказа</TableHead>
                <TableHead className="text-right">Действия</TableHead>
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
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.order_number}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {order.ozon_order_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{order.customer_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          <Badge variant={getStatusVariant(order.status)}>
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
                      <TableCell>
                        <span className="text-sm font-medium">
                          {itemCount} {itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {fulfillmentTypes.readyStock > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              <Warehouse className="h-3 w-3 mr-1" />
                              {fulfillmentTypes.readyStock}
                            </Badge>
                          )}
                          {fulfillmentTypes.produce > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              <Factory className="h-3 w-3 mr-1" />
                              {fulfillmentTypes.produce}
                            </Badge>
                          )}
                          {fulfillmentTypes.fbo > 0 && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              <Package className="h-3 w-3 mr-1" />
                              {fulfillmentTypes.fbo}
                            </Badge>
                          )}
                          {fulfillmentTypes.pending > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              <Clock className="h-3 w-3 mr-1" />
                              {fulfillmentTypes.pending}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {Math.round(Number.parseFloat(order.total_amount?.toString() || "0"))} ₽
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(order.order_date)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            Подробнее
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Заказов не найдено. Нажмите &quot;Синхронизировать заказы&quot; для импорта с Ozon.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
