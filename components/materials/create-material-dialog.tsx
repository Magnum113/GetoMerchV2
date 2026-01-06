"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = ["S", "M", "L", "XL", "XXL"]
const MATERIAL_TYPES = ["футболка", "худи", "укороченное худи"]
const DEFAULT_COLORS = ["белый", "черный", "вареная серая"]

export function CreateMaterialDialog() {
  const [open, setOpen] = useState(false)
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("шт")
  const [size, setSize] = useState("")
  const [materialType, setMaterialType] = useState("")
  const [color, setColor] = useState("")
  const [colorOpen, setColorOpen] = useState(false)
  const [showCustomColorInput, setShowCustomColorInput] = useState(false)
  const [quantityInStock, setQuantityInStock] = useState("0")
  const [minStockLevel, setMinStockLevel] = useState("0")
  const [costPerUnit, setCostPerUnit] = useState("0")
  const [supplier, setSupplier] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!sku || !name) {
      alert("Заполните обязательные поля: SKU и название")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/materials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          name,
          unit: unit || "шт",
          size: size || null,
          material_type: materialType || null,
          color: color || null,
          quantity_in_stock: Number.parseFloat(quantityInStock) || 0,
          min_stock_level: Number.parseFloat(minStockLevel) || 0,
          cost_per_unit: Number.parseFloat(costPerUnit) || 0,
          supplier: supplier || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось создать материал")
      }

      setOpen(false)
      setSku("")
      setName("")
      setUnit("шт")
      setSize("")
      setMaterialType("")
      setColor("")
      setShowCustomColorInput(false)
      setQuantityInStock("0")
      setMinStockLevel("0")
      setCostPerUnit("0")
      setSupplier("")
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка создания материала:", error)
      alert(error instanceof Error ? error.message : "Не удалось создать материал. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleColorSelect = (selectedColor: string) => {
    if (selectedColor === "custom") {
      setShowCustomColorInput(true)
      setColor("")
      setColorOpen(false)
    } else {
      setColor(selectedColor)
      setColorOpen(false)
      setShowCustomColorInput(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Добавить материал
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить материал</DialogTitle>
          <DialogDescription>Создайте новый материал для производства</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                placeholder="MAT-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                placeholder="Например: Пустая футболка"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="materialType">Тип материала</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Размер</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите размер" />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              {showCustomColorInput ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Введите свой цвет"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCustomColorInput(false)
                      setColor("")
                    }}
                    className="w-full"
                  >
                    Выбрать из списка
                  </Button>
                </div>
              ) : (
                <Popover open={colorOpen} onOpenChange={setColorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={colorOpen}
                      className="w-full justify-between"
                    >
                      {color || "Выберите цвет"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Поиск цвета..." />
                      <CommandList>
                        <CommandEmpty>Цвет не найден</CommandEmpty>
                        <CommandGroup>
                          {DEFAULT_COLORS.map((c) => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={() => handleColorSelect(c)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  color === c ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {c}
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="custom"
                            onSelect={() => handleColorSelect("custom")}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить свой цвет
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit">Единица измерения</Label>
              <Input
                id="unit"
                placeholder="шт"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Например: шт, кг, м</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Поставщик</Label>
              <Input
                id="supplier"
                placeholder="Название поставщика"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="quantityInStock">Количество на складе</Label>
              <Input
                id="quantityInStock"
                type="number"
                step="0.01"
                placeholder="0"
                value={quantityInStock}
                onChange={(e) => setQuantityInStock(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockLevel">Минимальный уровень</Label>
              <Input
                id="minStockLevel"
                type="number"
                step="0.01"
                placeholder="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPerUnit">Цена за единицу (₽)</Label>
              <Input
                id="costPerUnit"
                type="number"
                step="0.01"
                placeholder="0"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !sku || !name}>
            {isSubmitting ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
