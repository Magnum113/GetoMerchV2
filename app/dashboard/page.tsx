import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Package, ShoppingCart, TrendingUp, Warehouse, Factory } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch dashboard statistics
  const [productsResult, inventoryResult, ordersResult, materialsResult, productionResult] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("inventory").select("quantity_in_stock, min_stock_level"),
    supabase.from("orders").select("*"),
    supabase.from("materials").select("quantity_in_stock, min_stock_level"),
    supabase.from("production_queue").select("*").eq("status", "pending"),
  ])

  // Calculate metrics
  const totalProducts = productsResult.count || 0
  const inventory = inventoryResult.data || []
  const orders = ordersResult.data || []
  const materials = materialsResult.data || []
  const pendingProduction = productionResult.data?.length || 0

  const lowStockItems = inventory.filter((item) => {
    const stockLevel = Number(item.quantity_in_stock)
    const minLevel = Number(item.min_stock_level)
    return Number.isFinite(stockLevel) && Number.isFinite(minLevel) && stockLevel <= minLevel
  }).length

  const lowStockMaterials = materials.filter((item) => {
    const stockLevel = Number(item.quantity_in_stock)
    const minLevel = Number(item.min_stock_level)
    return Number.isFinite(stockLevel) && Number.isFinite(minLevel) && stockLevel <= minLevel
  }).length

  console.log("[v0] Dashboard metrics calculated:", {
    totalProducts,
    lowStockItems,
    lowStockMaterials,
    pendingOrders: orders.filter((o) => o.status === "awaiting_packaging" || o.status === "awaiting_deliver").length,
  })

  const pendingOrders = orders.filter(
    (o) => o.status === "awaiting_packaging" || o.status === "awaiting_deliver",
  ).length
  const totalRevenue = orders.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)

  const totalStock = inventory.reduce((sum, item) => sum + item.quantity_in_stock, 0)
  const avgStockLevel = inventory.length > 0 ? totalStock / inventory.length : 0

  // Recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: allInventory } = await supabase
    .from("inventory")
    .select("*, products(*)")
    .order("quantity_in_stock", { ascending: true })
    .limit(20)

  const lowStockProducts = (allInventory || [])
    .filter((item) => {
      const stockLevel = Number(item.quantity_in_stock)
      const minLevel = Number(item.min_stock_level)
      return Number.isFinite(stockLevel) && Number.isFinite(minLevel) && stockLevel <= minLevel
    })
    .slice(0, 5)

  console.log("[v0] Low stock products found:", lowStockProducts.length)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Панель управления</h1>
        <p className="text-muted-foreground mt-1">Обзор управления товарами Ozon</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Всего товаров</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">В каталоге</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Заказы в обработке</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Ожидают обработки</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Предупреждения об остатках</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{lowStockItems + lowStockMaterials}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {lowStockItems} товаров, {lowStockMaterials} материалов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Очередь производства</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingProduction}</div>
            <p className="text-xs text-muted-foreground mt-1">Элементов в очереди</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Последние заказы</CardTitle>
            <CardDescription>Последние заказы с маркетплейса Ozon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders && recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          order.status === "delivered"
                            ? "default"
                            : order.status === "awaiting_packaging"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {order.status === "delivered"
                          ? "доставлен"
                          : order.status === "awaiting_packaging"
                            ? "ожидает упаковки"
                            : "в пути"}
                      </Badge>
                      <span className="text-sm font-medium">{Math.round(order.total_amount)} ₽</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Заказов не найдено</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <CardTitle>Обзор инвентаря</CardTitle>
            <CardDescription>Уровни остатков на складе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Средний уровень остатков</span>
                  <span className="font-medium">{Math.round(avgStockLevel)} единиц</span>
                </div>
                <Progress value={(avgStockLevel / 50) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Всего позиций на складе</span>
                  <span className="font-medium">{totalStock} единиц</span>
                </div>
                <Progress value={(totalStock / 200) * 100} className="h-2" />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">{lowStockItems} товаров ниже минимума</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Требуется пополнение для продолжения работы</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Статус системы</CardTitle>
          <CardDescription>Обзор всех компонентов системы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium">Каталог</p>
                <p className="text-xs text-muted-foreground">Работает</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                <Warehouse className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium">Инвентарь</p>
                <p className="text-xs text-muted-foreground">Работает</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium">Ozon API</p>
                <p className="text-xs text-muted-foreground">Не настроен</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
