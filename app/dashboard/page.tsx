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
    <div className="space-y-6 p-4 md:p-6 lg:p-8 min-h-screen bg-muted/30">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Панель управления</h1>
        <p className="text-muted-foreground">Обзор управления товарами Ozon</p>
      </div>

      {/* Key Metrics - Улучшенные карточки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-sm hover:shadow-md transition-all overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-muted/40">
            <CardTitle className="text-sm font-semibold text-foreground/90 flex items-center h-10">Всего товаров</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-foreground mb-1">{totalProducts}</div>
            <p className="text-xs text-muted-foreground font-medium">В каталоге</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-muted/40">
            <CardTitle className="text-sm font-semibold text-foreground/90 flex items-center h-10">Заказы в обработке</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-foreground mb-1">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground font-medium">Ожидают обработки</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-muted/40">
            <CardTitle className="text-sm font-semibold text-foreground/90 flex items-center h-10">Предупреждения</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600 mb-1">{lowStockItems + lowStockMaterials}</div>
            <p className="text-xs text-muted-foreground font-medium">
              {lowStockItems} товаров, {lowStockMaterials} материалов
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-muted/40">
            <CardTitle className="text-sm font-semibold text-foreground/90 flex items-center h-10">Очередь производства</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
              <Factory className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-foreground mb-1">{pendingProduction}</div>
            <p className="text-xs text-muted-foreground font-medium">Элементов в очереди</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Orders */}
        <Card className="border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg font-semibold">Последние заказы</CardTitle>
            <CardDescription className="text-sm">Последние заказы с маркетплейса Ozon</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {recentOrders && recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors border border-border"
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          order.status === "delivered"
                            ? "default"
                            : order.status === "awaiting_packaging"
                              ? "secondary"
                              : "outline"
                        }
                        className="font-medium"
                      >
                        {order.status === "delivered"
                          ? "доставлен"
                          : order.status === "awaiting_packaging"
                            ? "ожидает упаковки"
                            : "в пути"}
                      </Badge>
                      <span className="text-sm font-bold text-foreground min-w-[80px] text-right">
                        {Math.round(order.total_amount)} ₽
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Заказов не найдено</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Status */}
        <Card className="border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg font-semibold">Обзор инвентаря</CardTitle>
            <CardDescription className="text-sm">Уровни остатков на складе</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Средний уровень остатков</span>
                  <span className="font-bold text-foreground">{Math.round(avgStockLevel)} единиц</span>
                </div>
                <Progress 
                  value={(avgStockLevel / 50) * 100} 
                  className="h-2.5 bg-muted/60" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Всего позиций на складе</span>
                  <span className="font-bold text-foreground">{totalStock} единиц</span>
                </div>
                <Progress 
                  value={(totalStock / 200) * 100} 
                  className="h-2.5 bg-muted/60" 
                />
              </div>
              {lowStockItems > 0 && (
                <div className="pt-4 border-t border-border rounded-lg bg-amber-50/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-900">{lowStockItems} товаров ниже минимума</span>
                  </div>
                  <p className="text-xs text-amber-700 ml-6">Требуется пополнение для продолжения работы</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-semibold">Статус системы</CardTitle>
          <CardDescription className="text-sm">Обзор всех компонентов системы</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-green-200/50 hover:shadow-sm transition-all">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Каталог</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs text-muted-foreground font-medium">Работает</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-green-200/50 hover:shadow-sm transition-all">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Warehouse className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Инвентарь</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs text-muted-foreground font-medium">Работает</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-amber-200/50 hover:shadow-sm transition-all">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ozon API</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <p className="text-xs text-muted-foreground font-medium">Не настроен</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
