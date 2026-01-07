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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
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
  const [selectedProducts, setSelectedProducts] = useState<Array<{ id: string; name: string; sku: string }>>(
    recipe.recipe_products?.map((rp: any) => rp.products).filter(Boolean) || []
  );
  const [selectedProductId, setSelectedProductId] = useState<string>('');
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
const handleAddProduct = (product: { id: string; name: string; sku: string }) => {
  if (!product) {
    alert("Пожалуйста, выберите продукт из списка")
    return
  }
  
  if (selectedProducts.find((p) => p.id === product.id)) {
    alert("Этот продукт уже добавлен в рецепт")
    return
  }
  
  setSelectedProducts([...selectedProducts, product]);
  setSelectedProductId(''); // Clear selection after adding
};

const handleRemoveProduct = (productId: string) => {
  setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
};

const handleSelectProduct = (value: string) => {
  setSelectedProductId(value);
};

const handleAddSelectedProduct = () => {
  const product = allProducts.find((p) => p.id === selectedProductId);
  if (product) {
    handleAddProduct(product);
  }
};
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

    if (selectedProducts.length === 0) {
      alert("Добавьте хотя бы один товар")
      return
    }
    
    // Validate that all selected products are still available (not deleted)
    const invalidProducts = selectedProducts.filter(p => !allProducts.some(ap => ap.id === p.id))
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
          products: selectedProducts.map((p) => p.id),
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
      {/* Product selection section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Товары *</Label>
          <div className="flex gap-2">
            <Select value={selectedProductId} onValueChange={handleSelectProduct} disabled={isLoadingProducts || allProducts.length === 0}>
              <SelectTrigger className="min-w-[250px]">
                <SelectValue placeholder={isLoadingProducts ? "Загрузка..." : allProducts.length === 0 ? "Нет доступных продуктов" : "Выберите товар"} />
              </SelectTrigger>
              <SelectContent>
                {allProducts.length > 0 ? (
                  allProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={selectedProducts.some(sp => sp.id === p.id)}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    {isLoadingProducts ? "Загрузка продуктов..." : "Нет доступных активных продуктов"}
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleAddSelectedProduct}
              disabled={!selectedProductId || isLoadingProducts}
              title={!selectedProductId ? "Сначала выберите продукт" : "Добавить выбранный продукт"}
            >
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </div>
        </div>
        
        {productsError && (
          <div className="p-2 bg-destructive/10 text-destructive rounded text-sm">
            Ошибка загрузки продуктов: {productsError}
          </div>
        )}
        
        <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-2">
          {selectedProducts.length > 0 ? (
            selectedProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded hover:bg-secondary/30 transition-colors">
                <div className="flex-1 truncate">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">({p.sku})</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRemoveProduct(p.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Удалить продукт из рецепта"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {isLoadingProducts ? "Загрузка..." : "Нет выбранных продуктов. Добавьте продукты, чтобы связать их с этим рецептом."}
            </div>
          )}
        </div>
        
        {selectedProducts.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Выбрано продуктов: {selectedProducts.length}
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

