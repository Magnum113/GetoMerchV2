"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Plus, Package, Edit, Trash2, Check, X } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getWarehouseLabel, getWarehouseColor, type WarehouseType } from "@/lib/types/warehouse"

type MaterialDefinition = {
  id: string
  name: string
  type: string
  attributes: any
  unit: string
}

type MaterialLot = {
  id: string
  material_definition_id: string
  supplier_name: string | null
  cost_per_unit: number
  quantity: number
  warehouse_id: string
  received_at: string
  material_definitions?: MaterialDefinition
}

type MaterialLotsDialogProps = {
  materialDefinitionId: string
  materialDefinitionName: string
}

export function MaterialLotsDialog({ materialDefinitionId, materialDefinitionName }: MaterialLotsDialogProps) {
  const [open, setOpen] = useState(false)
  const [lots, setLots] = useState<MaterialLot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newLot, setNewLot] = useState({
    supplier_name: "",
    cost_per_unit: "0",
    quantity: "0",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingLot, setEditingLot] = useState<MaterialLot | null>(null)
  const [editForm, setEditForm] = useState({
    quantity: "",
    cost_per_unit: "",
    supplier_name: "",
  })
  const router = useRouter()

  useEffect(() => {
    if (open && materialDefinitionId) {
      loadLots()
    }
  }, [open, materialDefinitionId])

  const loadLots = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/materials/lots?definition_id=${materialDefinitionId}`)
      const data = await response.json()
      if (data.success) {
        setLots(data.lots || [])
      }
    } catch (error) {
      console.error("[v0] Ошибка загрузки партий:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLot = async () => {
    if (!newLot.quantity || Number.parseFloat(newLot.quantity) <= 0) {
      toast.error("Укажите количество партии")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/materials/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_definition_id: materialDefinitionId,
          supplier_name: newLot.supplier_name || null,
          cost_per_unit: Number.parseFloat(newLot.cost_per_unit) || 0,
          quantity: Number.parseFloat(newLot.quantity),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось создать партию")
      }

      toast.success("Партия успешно создана!")
      setNewLot({ supplier_name: "", cost_per_unit: "0", quantity: "0" })
      await loadLots()
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка создания партии:", error)
      toast.error(error instanceof Error ? error.message : "Не удалось создать партию")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditLot = (lot: MaterialLot) => {
    setEditingLot(lot)
    setEditForm({
      quantity: lot.quantity.toString(),
      cost_per_unit: lot.cost_per_unit.toString(),
      supplier_name: lot.supplier_name || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingLot || !editForm.quantity || Number.parseFloat(editForm.quantity) < 0) {
      toast.error("Укажите корректное количество")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/materials/lots/${editingLot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number.parseFloat(editForm.quantity),
          cost_per_unit: Number.parseFloat(editForm.cost_per_unit) || 0,
          supplier_name: editForm.supplier_name || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось обновить партию")
      }

      toast.success("Партия успешно обновлена!")
      setEditingLot(null)
      setEditForm({ quantity: "", cost_per_unit: "", supplier_name: "" })
      await loadLots()
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка обновления партии:", error)
      toast.error(error instanceof Error ? error.message : "Не удалось обновить партию")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLot = async (lotId: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту партию?")) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/materials/lots/${lotId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось удалить партию")
      }

      toast.success("Партия успешно удалена!")
      await loadLots()
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка удаления партии:", error)
      toast.error(error instanceof Error ? error.message : "Не удалось удалить партию")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalQuantity = lots.reduce((sum, lot) => sum + Number.parseFloat(lot.quantity || 0), 0)
  const avgCost = lots.length > 0
    ? lots.reduce((sum, lot) => sum + Number.parseFloat(lot.cost_per_unit || 0) * Number.parseFloat(lot.quantity || 0), 0) / totalQuantity
    : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Package className="h-4 w-4 mr-1" />
          Партии
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Партии материала: {materialDefinitionName}</DialogTitle>
          <DialogDescription>Управление партиями материала от разных поставщиков</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Добавление новой партии */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Добавить новую партию</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="supplier">Поставщик</Label>
                <Input
                  id="supplier"
                  placeholder="Название поставщика"
                  value={newLot.supplier_name}
                  onChange={(e) => setNewLot({ ...newLot, supplier_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Цена за единицу (₽)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={newLot.cost_per_unit}
                  onChange={(e) => setNewLot({ ...newLot, cost_per_unit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Количество</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={newLot.quantity}
                  onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAddLot} disabled={isSubmitting || !newLot.quantity}>
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting ? "Создание..." : "Добавить партию"}
            </Button>
          </div>

          {/* Статистика */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Всего партий</div>
              <div className="text-2xl font-bold">{lots.length}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Общее количество</div>
              <div className="text-2xl font-bold">{Math.round(totalQuantity)}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Средняя цена</div>
              <div className="text-2xl font-bold">{Math.round(avgCost)} ₽</div>
            </div>
          </div>

          {/* Список партий */}
          <div className="w-full overflow-hidden">
            <h3 className="font-medium mb-2">Список партий (FIFO)</h3>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : lots.length > 0 ? (
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Поставщик</TableHead>
                      <TableHead>Количество</TableHead>
                      <TableHead>Цена/Ед.</TableHead>
                      <TableHead>Общая стоимость</TableHead>
                      <TableHead>Получено</TableHead>
                      <TableHead>Склад</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => {
                      const isEditingThisLot = editingLot?.id === lot.id
                      return (
                        <TableRow key={lot.id}>
                        <TableCell>
                          {isEditingThisLot ? (
                            <Input
                              placeholder="Поставщик"
                              value={editForm.supplier_name}
                              onChange={(e) => setEditForm({ ...editForm, supplier_name: e.target.value })}
                              className="w-32"
                            />
                          ) : (
                            <span className="font-medium">{lot.supplier_name || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditingThisLot ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span className="font-medium">{Math.round(Number.parseFloat(lot.quantity || 0))}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditingThisLot ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editForm.cost_per_unit}
                              onChange={(e) => setEditForm({ ...editForm, cost_per_unit: e.target.value })}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span>{Math.round(Number.parseFloat(lot.cost_per_unit || 0))} ₽</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {isEditingThisLot
                              ? Math.round(Number.parseFloat(editForm.quantity || 0) * Number.parseFloat(editForm.cost_per_unit || 0))
                              : Math.round(Number.parseFloat(lot.quantity || 0) * Number.parseFloat(lot.cost_per_unit || 0))}{" "}
                            ₽
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(lot.received_at).toLocaleDateString("ru-RU")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getWarehouseColor(lot.warehouse_id as WarehouseType)}>
                            {getWarehouseLabel(lot.warehouse_id as WarehouseType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditingThisLot ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={isSubmitting}
                                  className="text-green-600 hover:text-green-700"
                                  title="Сохранить"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingLot(null)
                                    setEditForm({ quantity: "", cost_per_unit: "", supplier_name: "" })
                                  }}
                                  disabled={isSubmitting}
                                  title="Отмена"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditLot(lot)}
                                  title="Редактировать партию"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteLot(lot.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Удалить партию"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Партий нет</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  )}

