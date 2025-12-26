import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Search, TrendingDown, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { AddInventoryDialog } from "@/components/inventory/add-inventory-dialog"

export default async function InventoryPage() {
  const supabase = await createClient()

  // Fetch inventory with product details
  const { data: inventoryItems } = await supabase
    .from("inventory")
    .select(
      `
      *,
      products(*)
    `,
    )
    .order("last_updated_at", { ascending: false })

  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("is_active", true)
    .order("name", { ascending: true })

  const existingInventoryProductIds = inventoryItems?.map((item) => item.product_id) || []

  // Calculate statistics
  const totalItems = inventoryItems?.length || 0
  const totalStock = inventoryItems?.reduce((sum, item) => sum + item.quantity_in_stock, 0) || 0
  const lowStockItems = inventoryItems?.filter((item) => item.quantity_in_stock <= item.min_stock_level).length || 0
  const reservedStock = inventoryItems?.reduce((sum, item) => sum + item.quantity_reserved, 0) || 0

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Управление инвентарём</h1>
          <p className="text-gray-600">Отслеживание и управление уровнями товарных остатков</p>
        </div>
        <AddInventoryDialog products={allProducts || []} existingInventoryProductIds={existingInventoryProductIds} />
      </div>

      {/* Statistics Cards - Улучшенный дизайн */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Всего товаров</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{totalItems}</div>
            <p className="text-xs text-gray-500 font-medium">В инвентаре</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-green-50 to-green-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Всего остатков</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{totalStock}</div>
            <p className="text-xs text-gray-500 font-medium">Единиц доступно</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Зарезервировано</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600 mb-1">{reservedStock}</div>
            <p className="text-xs text-gray-500 font-medium">Единиц зарезервировано</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-red-50 to-red-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Предупреждения</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-red-600 mb-1">{lowStockItems}</div>
            <p className="text-xs text-gray-500 font-medium">Позиций ниже минимума</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems > 0 && (
        <Card className="border-0 shadow-soft border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-amber-900 font-semibold">Предупреждение об остатках</CardTitle>
                <CardDescription className="text-amber-700">
                  {lowStockItems} {lowStockItems === 1 ? "товар" : "товаров"} ниже минимального уровня остатков и требуют
                  пополнения
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Inventory Table */}
      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Уровни остатков</CardTitle>
              <CardDescription className="text-sm">Текущий инвентарь на всех складах</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Поиск в инвентаре..." 
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
                  <TableHead className="font-semibold text-gray-700">Товар</TableHead>
                  <TableHead className="font-semibold text-gray-700">Артикул</TableHead>
                  <TableHead className="font-semibold text-gray-700">Склад</TableHead>
                  <TableHead className="font-semibold text-gray-700">В наличии</TableHead>
                  <TableHead className="font-semibold text-gray-700">Зарезервировано</TableHead>
                  <TableHead className="font-semibold text-gray-700">Доступно</TableHead>
                  <TableHead className="font-semibold text-gray-700">Статус</TableHead>
                  <TableHead className="font-semibold text-gray-700">Уровень остатков</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems && inventoryItems.length > 0 ? (
                  inventoryItems.map((item) => {
                    const product = item.products
                    const available = item.quantity_in_stock - item.quantity_reserved
                    const stockPercentage = (item.quantity_in_stock / (item.min_stock_level * 2)) * 100
                    const isLowStock = item.quantity_in_stock <= item.min_stock_level
                    const isCritical = item.quantity_in_stock < item.min_stock_level * 0.5

                    return (
                      <TableRow 
                        key={item.id}
                        className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                      >
                        <TableCell className="py-4">
                          <div className="font-semibold text-gray-900">
                            {product?.name && product.name !== product.sku ? product.name : product?.sku}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-mono text-sm text-gray-600">{product?.sku}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600">{item.warehouse_location || "—"}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                              {item.quantity_in_stock}
                            </span>
                            {item.quantity_in_stock > item.min_stock_level && (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            )}
                            {isLowStock && <TrendingDown className="h-4 w-4 text-amber-600" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600 font-medium">{item.quantity_reserved}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-bold text-gray-900">{available}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          {isCritical ? (
                            <Badge variant="destructive" className="font-medium">Критический</Badge>
                          ) : isLowStock ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 font-medium">
                              Низкий остаток
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 font-medium">В наличии</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="w-28 space-y-1">
                            <Progress
                              value={Math.min(stockPercentage, 100)}
                              className="h-2.5 bg-gray-100"
                            />
                            <span className="text-xs text-gray-500 font-medium">Мин: {item.min_stock_level}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <StockAdjustmentDialog inventoryId={item.id} productName={product?.name || ""} />
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-12 w-12 text-gray-300" />
                        <p className="text-sm text-gray-500 font-medium">Позиции инвентаря не найдены</p>
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
