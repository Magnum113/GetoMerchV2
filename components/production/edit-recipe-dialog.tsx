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
import { Plus, Trash2, Search, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createBrowserClient } from "@/lib/supabase/client"

type Material = {
  id: string
  name: string
  unit: string
}

type RecipeMaterial = {
  id?: string
  material_id: string
  quantity_needed: number
  materials?: Material
}

type Recipe = {
  id: string
  name: string
  description: string | null
  production_time_minutes: number | null
  recipe_products?: Array<{ products: { id: string; name: string; sku: string } }>
  recipe_materials?: RecipeMaterial[]
}

type EditRecipeDialogProps = {
  recipe: Recipe
}

export function EditRecipeDialog({ recipe }: EditRecipeDialogProps) {
  const [open, setOpen] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [recipeName, setRecipeName] = useState(recipe.name)
  const [description, setDescription] = useState(recipe.description || "")
  const [productionTime, setProductionTime] = useState(recipe.production_time_minutes?.toString() || "")
  const [recipeMaterials, setRecipeMaterials] = useState<Array<{ id?: string; materialId: string; quantity: string }>>(
    recipe.recipe_materials?.map((rm: any) => ({
      id: rm.id,
      materialId: rm.material_definition_id || "",
      quantity: (rm.quantity_required || rm.quantity_needed || 0).toString(),
    })) || [{ materialId: "", quantity: "" }],
  )

  // Fetch all active products when dialog opens
  const [allProducts, setAllProducts] = useState<Array<{ id: string; name: string; sku: string }>>([])
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set(
    recipe.recipe_products?.map((rp: any) => rp.products?.id).filter(Boolean) || []
  ));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Load products from Supabase
      const fetchProducts = async () => {
        setIsLoadingProducts(true);
        setProductsError(null);
        try {
          const supabase = createBrowserClient()
          const { data, error } = await supabase.from("products").select("id, name, sku").eq("is_active", true).order("name", { ascending: true })
          if (error) throw error
          setAllProducts(data || [])
        } catch (err) {
          console.error("[v0] Ошибка загрузки продуктов:", err)
          setProductsError(err instanceof Error ? err.message : "Не удалось загрузить продукты")
        } finally {
          setIsLoadingProducts(false);
        }
      }
      fetchProducts()
    }
  }, [open])

// Product selection helpers
const handleProductToggle = (productId: string) => {
  const newSet = new Set(selectedProductIds)
  if (newSet.has(productId)) {
    newSet.delete(productId)
  } else {
    newSet.add(productId)
  }
  setSelectedProductIds(newSet)
};

const filteredProducts = allProducts.filter(
  (p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()),
);

const selectedProducts = allProducts.filter((p) => selectedProductIds.has(p.id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (open) {
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

  const handleSubmit = async () => {
    if (!recipeName) {
      alert("Укажите название рецепта")
      return
    }

    const validMaterials = recipeMaterials.filter((rm) => rm.materialId && rm.quantity)

    if (validMaterials.length === 0) {
      alert("Добавьте хотя бы один материал")
      return
    }

    if (selectedProductIds.size === 0) {
      alert("Выберите хотя бы один товар")
      return
    }
    
    // Validate that all selected products are still available (not deleted)
    const invalidProducts = allProducts.filter(p => selectedProductIds.has(p.id) && !p.id)
    if (invalidProducts.length > 0) {
      alert(`Следующие продукты больше не доступны: ${invalidProducts.map(p => p.name).join(', ')}`)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/production/recipes/${recipe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeName,
          description: description || null,
          production_time_minutes: productionTime ? Number.parseInt(productionTime) : null,
          materials: validMaterials.map((rm) => ({
            id: rm.id,
            material_definition_id: rm.materialId,
            quantity_required: Number.parseFloat(rm.quantity),
          })),
          products: Array.from(selectedProductIds),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось обновить рецепт")
      }

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка обновления рецепта:", error)
      alert(error instanceof Error ? error.message : "Не удалось обновить рецепт. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Изменить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Изменить рецепт</DialogTitle>
          <DialogDescription>Редактирование рецепта производства</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
      {/* Product selection section - Multi-select implementation */}
      <div className="space-y-4">
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
        
        {productsError && (
          <div className="p-2 bg-destructive/10 text-destructive rounded text-sm">
            Ошибка загрузки продуктов: {productsError}
          </div>
        )}
      </div>
      <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !recipeName}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

