import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Plus, Search, Boxes, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { CreateMaterialDialog } from "@/components/materials/create-material-dialog"
import { MaterialLotsDialog } from "@/components/materials/material-lots-dialog"
import { EditMaterialDialog } from "@/components/materials/edit-material-dialog"
import { DeleteMaterialDefinitionDialog } from "@/components/materials/delete-material-definition-dialog"
import { getWarehouseLabel, getWarehouseColor, type WarehouseType } from "@/lib/types/warehouse"

export default async function MaterialsPage() {
  const supabase = await createClient()

  // Fetch material definitions with availability
  const { data: warehouseMaterials } = await supabase
    .from("material_availability_by_warehouse")
    .select("*")
    .order("material_name", { ascending: true })

  // Aggregate materials by definition to show warehouse breakdown
  const materialsMap = new Map<string, {
    material_name: string
    unit: string
    attributes: any
    warehouse_details: Record<WarehouseType, { quantity: number; available_quantity: number }>
    total_quantity: number
    available_quantity: number
    avg_cost_per_unit: number
  }>()

  for (const item of warehouseMaterials || []) {
    const existing = materialsMap.get(item.material_definition_id) || {
      material_name: item.material_name,
      unit: item.unit,
      attributes: item.attributes || {},
      warehouse_details: {},
      total_quantity: 0,
      available_quantity: 0,
      avg_cost_per_unit: item.avg_cost_per_unit || 0,
    }

    existing.warehouse_details[item.warehouse_type as WarehouseType] = {
      quantity: item.total_quantity,
      available_quantity: item.available_quantity,
    }
    existing.total_quantity += item.total_quantity
    existing.available_quantity += item.available_quantity

    materialsMap.set(item.material_definition_id, existing)
  }

  const materials = Array.from(materialsMap.values())

  // Calculate statistics
  const totalMaterials = materials?.length || 0
  const lowStockMaterials = materials?.filter((m: any) => (m.available_quantity || 0) <= 10).length || 0
  const totalValue = materials?.reduce((sum: number, m: any) => sum + (m.available_quantity || 0) * (m.avg_cost_per_unit || 0), 0) || 0

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Управление материалами</h1>
          <p className="text-gray-600">Отслеживание сырья и производственных материалов</p>
        </div>
        <CreateMaterialDialog />
      </div>

      {/* Statistics Cards - Улучшенный дизайн */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Всего материалов</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Boxes className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{totalMaterials}</div>
            <p className="text-xs text-gray-500 font-medium">Разных типов</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Стоимость запасов</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900 mb-1">{Math.round(totalValue).toLocaleString('ru-RU')} ₽</div>
            <p className="text-xs text-gray-500 font-medium">Общая стоимость</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Низкие запасы</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600 mb-1">{lowStockMaterials}</div>
            <p className="text-xs text-gray-500 font-medium">Требуют пополнения</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockMaterials > 0 && (
        <Card className="border-0 shadow-soft border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-amber-900 font-semibold">Предупреждение о материалах</CardTitle>
                <CardDescription className="text-amber-700">
                  {lowStockMaterials} {lowStockMaterials === 1 ? "материал ниже" : "материалов ниже"} минимального уровня
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Materials Table */}
      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Запасы материалов</CardTitle>
              <CardDescription className="text-sm">Сырьё и материалы для производства</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Поиск материалов..." 
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
          <TableHead className="font-semibold text-gray-700">Материал</TableHead>
          <TableHead className="font-semibold text-gray-700">Домашний склад</TableHead>
          <TableHead className="font-semibold text-gray-700">Производственный склад</TableHead>
          <TableHead className="font-semibold text-gray-700">Всего</TableHead>
          <TableHead className="font-semibold text-gray-700">Цена/Ед.</TableHead>
          <TableHead className="font-semibold text-gray-700">Общая стоимость</TableHead>
          <TableHead className="font-semibold text-gray-700">Поставщик</TableHead>
          <TableHead className="font-semibold text-gray-700">Статус</TableHead>
          <TableHead className="text-right font-semibold text-gray-700">Действия</TableHead>
        </TableRow>
      </TableHeader>
            <TableBody>
              {materials && materials.length > 0 ? (
              materials.map((material) => {
                const attributes = (material.attributes || {}) as Record<string, any>
                const homeQuantity = material.warehouse_details?.HOME?.available_quantity || 0
                const productionQuantity = material.warehouse_details?.PRODUCTION_CENTER?.available_quantity || 0
                const totalQuantity = material.available_quantity || 0
                const isLowStock = totalQuantity <= 10
                const isCritical = totalQuantity < 5
                const stockPercentage = Math.min((totalQuantity / 50) * 100, 100)
                const totalValue = totalQuantity * (material.avg_cost_per_unit || 0)

                  return (
                    <TableRow 
                      key={material.material_definition_id}
                      className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                    >
                      <TableCell className="py-4">
                        <div className="font-semibold text-gray-900">{material.material_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {attributes.material_type && `${attributes.material_type} `}
                          {attributes.color && `${attributes.color} `}
                          {attributes.size && `Размер: ${attributes.size}`}
                          {material.unit && ` • ${material.unit}`}
                        </div>
                      </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                            {Math.round(homeQuantity)}
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {material.warehouse_details?.HOME?.quantity && `из ${Math.round(material.warehouse_details.HOME.quantity)}`}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                            {Math.round(productionQuantity)}
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {material.warehouse_details?.PRODUCTION_CENTER?.quantity && `из ${Math.round(material.warehouse_details.PRODUCTION_CENTER.quantity)}`}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                            {Math.round(totalQuantity)}
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            из {Math.round(material.total_quantity || 0)}
                          </div>
                        </TableCell>
                      <TableCell className="py-4">
                        <span className="font-semibold text-gray-900">{Math.round(material.avg_cost_per_unit || 0)} ₽</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-bold text-gray-900">{Math.round(totalValue).toLocaleString('ru-RU')} ₽</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-gray-600">Несколько поставщиков</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-2">
                          {isCritical ? (
                            <Badge variant="destructive" className="font-medium">Критично</Badge>
                          ) : isLowStock ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 font-medium">
                              Мало
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 font-medium">В наличии</Badge>
                          )}
                          <Progress
                            value={Math.min(stockPercentage, 100)}
                            className={`h-2 bg-gray-100 w-20 ${isCritical ? "[&>div]:bg-red-500" : isLowStock ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex items-center justify-end gap-1">
                          <MaterialLotsDialog
                            materialDefinitionId={material.material_definition_id}
                            materialDefinitionName={material.material_name}
                          />
                          <EditMaterialDialog
                            materialDefinitionId={material.material_definition_id}
                            materialName={material.material_name}
                            currentAttributes={material.attributes}
                            currentUnit={material.unit}
                          />
                          <DeleteMaterialDefinitionDialog
                            materialDefinitionId={material.material_definition_id}
                            materialName={material.material_name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Boxes className="h-12 w-12 text-gray-300" />
                      <p className="text-sm text-gray-500 font-medium">Материалов не найдено</p>
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
