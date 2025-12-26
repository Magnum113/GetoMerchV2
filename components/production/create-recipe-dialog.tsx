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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Plus, Search, X, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

type Product = {
  id: string
  name: string
  sku: string
}

type Material = {
  id: string
  name: string
  unit: string
}

export function CreateRecipeDialog() {
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [recipeName, setRecipeName] = useState("")
  const [description, setDescription] = useState("")
  const [productionTime, setProductionTime] = useState("")
  const [recipeMaterials, setRecipeMaterials] = useState<Array<{ materialId: string; quantity: string }>>([
    { materialId: "", quantity: "" },
  ])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      // Загружаем товары
      fetch("/api/production/products")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setProducts(data.products || [])
          }
        })
        .catch(console.error)

      // Загружаем определения материалов
      fetch("/api/production/material-definitions")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMaterials(data.definitions || [])
          }
        })
        .catch(console.error)
    }
  }, [open])

  const handleProductToggle = (productId: string) => {
    const newSet = new Set(selectedProductIds)
    if (newSet.has(productId)) {
      newSet.delete(productId)
    } else {
      newSet.add(productId)
    }
    setSelectedProductIds(newSet)
  }

  const handleAddMaterial = () => {
    setRecipeMaterials([...recipeMaterials, { materialId: "", quantity: "" }])
  }

  const handleRemoveMaterial = (index: number) => {
    setRecipeMaterials(recipeMaterials.filter((_, i) => i !== index))
  }

  const handleMaterialChange = (index: number, field: "materialId" | "quantity", value: string) => {
    const updated = [...recipeMaterials]
    updated[index][field] = value
    setRecipeMaterials(updated)
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSubmit = async () => {
    if (selectedProductIds.size === 0 || !recipeName) {
      alert("Выберите хотя бы один товар и укажите название рецепта")
      return
    }

    const validMaterials = recipeMaterials.filter((rm) => rm.materialId && rm.quantity)

    if (validMaterials.length === 0) {
      alert("Добавьте хотя бы один материал")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/production/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_ids: Array.from(selectedProductIds),
          name: recipeName,
          description: description || null,
          production_time_minutes: productionTime ? Number.parseInt(productionTime) : null,
          materials: validMaterials.map((rm) => ({
            material_definition_id: rm.materialId,
            quantity_required: Number.parseFloat(rm.quantity),
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось создать рецепт")
      }

      setOpen(false)
      setSelectedProductIds(new Set())
      setRecipeName("")
      setDescription("")
      setProductionTime("")
      setRecipeMaterials([{ materialId: "", quantity: "" }])
      setSearchQuery("")
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка создания рецепта:", error)
      alert(error instanceof Error ? error.message : "Не удалось создать рецепт. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedProducts = products.filter((p) => selectedProductIds.has(p.id))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Создать рецепт
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать рецепт</DialogTitle>
          <DialogDescription>Создайте новый рецепт производства для одного или нескольких товаров</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Товары *</Label>
            <div className="border rounded-md p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск товаров..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-secondary/50 rounded-md">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-1 px-2 py-1 bg-background rounded-md text-sm"
                    >
                      <span>{product.name}</span>
                      {product.name !== product.sku && (
                        <span className="text-muted-foreground">({product.sku})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleProductToggle(product.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => handleProductToggle(product.id)}
                        />
                        <label
                          htmlFor={`product-${product.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          <span>{product.name}</span> <span className="text-muted-foreground">({product.sku})</span>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">Товары не найдены</div>
                  )}
                </div>
              </ScrollArea>
              <div className="text-xs text-muted-foreground">
                Выбрано: {selectedProductIds.size} {selectedProductIds.size === 1 ? "товар" : "товаров"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Название рецепта *</Label>
            <Input
              id="name"
              placeholder="Например: Рецепт для футболки"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Описание рецепта (необязательно)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productionTime">Время производства (минуты)</Label>
            <Input
              id="productionTime"
              type="number"
              placeholder="30"
              value={productionTime}
              onChange={(e) => setProductionTime(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Материалы *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddMaterial}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить материал
              </Button>
            </div>

            {recipeMaterials.map((rm, index) => (
              <div key={index} className="flex gap-2 items-end border rounded-lg p-3 bg-secondary/30">
                <div className="flex-1 space-y-2">
                  <Label>Материал</Label>
                  <Select value={rm.materialId} onValueChange={(value) => handleMaterialChange(index, "materialId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите материал" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name} ({material.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-2">
                  <Label>Количество</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1"
                    value={rm.quantity}
                    onChange={(e) => handleMaterialChange(index, "quantity", e.target.value)}
                    className="text-right"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMaterial(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Удалить материал"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedProductIds.size === 0 || !recipeName}>
            {isSubmitting ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
