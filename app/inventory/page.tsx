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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Управление инвентарём</h1>
          <p className="text-muted-foreground mt-1">Отслеживание и управление уровнями товарных остатков</p>
        </div>
        <AddInventoryDialog products={allProducts || []} existingInventoryProductIds={existingInventoryProductIds} />
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего товаров</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">В инвентаре</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего остатков</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground mt-1">Единиц доступно</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Зарезервировано</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{reservedStock}</div>
            <p className="text-xs text-muted-foreground mt-1">Единиц зарезервировано</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Предупреждения об остатках</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Позиций ниже минимума</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-warning">Предупреждение об остатках</CardTitle>
            </div>
            <CardDescription>
              {lowStockItems} {lowStockItems === 1 ? "товар" : "товаров"} ниже минимального уровня остатков и требуют
              пополнения
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Уровни остатков</CardTitle>
              <CardDescription>Текущий инвентарь на всех складах</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Поиск в инвентаре..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Склад</TableHead>
                <TableHead>В наличии</TableHead>
                <TableHead>Зарезервировано</TableHead>
                <TableHead>Доступно</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Уровень остатков</TableHead>
                <TableHead className="text-right">Действия</TableHead>
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
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">
                          {product?.name && product.name !== product.sku ? product.name : product?.sku}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{product?.sku}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.warehouse_location || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isLowStock ? "text-warning" : ""}`}>
                            {item.quantity_in_stock}
                          </span>
                          {item.quantity_in_stock > item.min_stock_level && (
                            <TrendingUp className="h-3 w-3 text-success" />
                          )}
                          {isLowStock && <TrendingDown className="h-3 w-3 text-warning" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{item.quantity_reserved}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{available}</span>
                      </TableCell>
                      <TableCell>
                        {isCritical ? (
                          <Badge variant="destructive">Критический</Badge>
                        ) : isLowStock ? (
                          <Badge variant="outline" className="text-warning border-warning">
                            Низкий остаток
                          </Badge>
                        ) : (
                          <Badge variant="default">В наличии</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress
                            value={Math.min(stockPercentage, 100)}
                            className="h-2"
                            indicatorClassName={isCritical ? "bg-destructive" : isLowStock ? "bg-warning" : ""}
                          />
                          <span className="text-xs text-muted-foreground mt-1">Мин: {item.min_stock_level}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <StockAdjustmentDialog inventoryId={item.id} productName={product?.name || ""} />
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Позиции инвентаря не найдены.
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
