import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { MaterialAdjustmentDialog } from "@/components/materials/material-adjustment-dialog"
import { DeleteMaterialDialog } from "@/components/materials/delete-material-dialog"

export default async function MaterialsPage() {
  const supabase = await createClient()

  // Fetch materials
  const { data: materials } = await supabase.from("materials").select("*").order("name", { ascending: true })

  // Calculate statistics
  const totalMaterials = materials?.length || 0
  const lowStockMaterials = materials?.filter((m) => m.quantity_in_stock <= m.min_stock_level).length || 0
  const totalValue = materials?.reduce((sum, m) => sum + m.quantity_in_stock * (m.cost_per_unit || 0), 0) || 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Управление материалами</h1>
          <p className="text-muted-foreground mt-1">Отслеживание сырья и производственных материалов</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Добавить материал
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего материалов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMaterials}</div>
            <p className="text-xs text-muted-foreground mt-1">Разных типов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Стоимость запасов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalValue)} ₽</div>
            <p className="text-xs text-muted-foreground mt-1">Общая стоимость</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Низкие запасы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{lowStockMaterials}</div>
            <p className="text-xs text-muted-foreground mt-1">Требуют пополнения</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockMaterials > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-warning">Предупреждение о материалах</CardTitle>
            </div>
            <CardDescription>
              {lowStockMaterials} {lowStockMaterials === 1 ? "материал ниже" : "материалов ниже"} минимального уровня
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Запасы материалов</CardTitle>
              <CardDescription>Сырьё и материалы для производства</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Поиск материалов..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Материал</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Единица</TableHead>
                <TableHead>На складе</TableHead>
                <TableHead>Мин. уровень</TableHead>
                <TableHead>Цена/Ед.</TableHead>
                <TableHead>Общая стоимость</TableHead>
                <TableHead>Поставщик</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials && materials.length > 0 ? (
                materials.map((material) => {
                  const isLowStock = material.quantity_in_stock <= material.min_stock_level
                  const isCritical = material.quantity_in_stock < material.min_stock_level * 0.5
                  const stockPercentage = (material.quantity_in_stock / (material.min_stock_level * 2)) * 100
                  const totalValue = material.quantity_in_stock * (material.cost_per_unit || 0)

                  return (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div className="font-medium">{material.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{material.sku}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{material.unit}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${isLowStock ? "text-warning" : ""}`}>
                          {Math.round(material.quantity_in_stock)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{Math.round(material.min_stock_level)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{Math.round(material.cost_per_unit || 0)} ₽</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{Math.round(totalValue)} ₽</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{material.supplier || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {isCritical ? (
                            <Badge variant="destructive">Критично</Badge>
                          ) : isLowStock ? (
                            <Badge variant="outline" className="text-warning border-warning">
                              Мало
                            </Badge>
                          ) : (
                            <Badge variant="default">В наличии</Badge>
                          )}
                          <Progress
                            value={Math.min(stockPercentage, 100)}
                            className="h-1 w-16"
                            indicatorClassName={isCritical ? "bg-destructive" : isLowStock ? "bg-warning" : ""}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <MaterialAdjustmentDialog materialId={material.id} materialName={material.name} />
                          <DeleteMaterialDialog materialId={material.id} materialName={material.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Материалов не найдено
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
