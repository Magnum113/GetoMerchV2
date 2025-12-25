import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { notFound } from "next/navigation"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch order with items
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items(
        *,
        products(*)
      )
    `,
    )
    .eq("id", id)
    .single()

  if (error || !order) {
    notFound()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("ru-RU", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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

  const itemsTotal = order.order_items?.reduce((sum, item) => sum + item.quantity * item.price, 0) || 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Детали заказа</h1>
          <p className="text-muted-foreground mt-1">Заказ #{order.order_number}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Order Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Информация о заказе</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Номер заказа</div>
                <div className="text-base font-medium">{order.order_number}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">ID заказа Ozon</div>
                <div className="text-base font-mono">{order.ozon_order_id}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Статус</div>
                <div className="mt-1">
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
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Клиент</div>
                <div className="text-base">{order.customer_name || "—"}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Дата заказа</div>
                <div className="text-base">{formatDate(order.order_date)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Дата доставки</div>
                <div className="text-base">{formatDate(order.delivery_date)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Сводка заказа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Сумма товаров:</span>
              <span className="font-medium">{Math.round(itemsTotal)} ₽</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-medium">Общая сумма:</span>
              <span className="text-lg font-bold">
                {Math.round(Number.parseFloat(order.total_amount?.toString() || "0"))} ₽
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Товары в заказе</CardTitle>
          <CardDescription>{order.order_items?.length || 0} товаров в этом заказе</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Цена за единицу</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.order_items && order.order_items.length > 0 ? (
                order.order_items.map((item) => {
                  const product = item.products
                  const subtotal = item.quantity * item.price

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="font-medium">{product?.name || "Неизвестный товар"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{product?.sku || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{item.quantity}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{Math.round(item.price)} ₽</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{Math.round(subtotal)} ₽</span>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Нет товаров в этом заказе.
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
