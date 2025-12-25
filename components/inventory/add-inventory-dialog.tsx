"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Plus, Check, ChevronsUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  name: string
  sku: string
}

interface AddInventoryDialogProps {
  products: Product[]
  existingInventoryProductIds: string[]
}

export function AddInventoryDialog({ products, existingInventoryProductIds }: AddInventoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [quantity, setQuantity] = useState<string>("0")
  const [minStockLevel, setMinStockLevel] = useState<string>("5")
  const [warehouseLocation, setWarehouseLocation] = useState<string>("HOME")
  const router = useRouter()

  const availableProducts = products.filter((p) => !existingInventoryProductIds.includes(p.id))

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) return

    setLoading(true)

    try {
      const response = await fetch("/api/inventory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: Number.parseInt(quantity, 10),
          minStockLevel: Number.parseInt(minStockLevel, 10),
          warehouseLocation,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Ошибка создания записи")
      }

      setOpen(false)
      setSelectedProductId("")
      setQuantity("0")
      setMinStockLevel("5")
      setWarehouseLocation("HOME")
      router.refresh()
    } catch (error) {
      console.error("Ошибка добавления остатков:", error)
      alert(error instanceof Error ? error.message : "Не удалось добавить остатки")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Добавить остатки
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Добавить товар на склад</DialogTitle>
            <DialogDescription>Выберите товар из каталога и укажите начальное количество на складе</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Товар</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="justify-between w-full bg-transparent"
                    disabled={availableProducts.length === 0}
                  >
                    {selectedProduct
                      ? selectedProduct.name && selectedProduct.name !== selectedProduct.sku
                        ? selectedProduct.name
                        : selectedProduct.sku
                      : "Выберите товар..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Поиск товара по названию или артикулу..." />
                    <CommandList>
                      <CommandEmpty>Товары не найдены.</CommandEmpty>
                      <CommandGroup>
                        {availableProducts.length > 0 ? (
                          availableProducts.map((product) => {
                            const displayName =
                              product.name && product.name !== product.sku ? product.name : product.sku
                            return (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku}`}
                                onSelect={() => {
                                  setSelectedProductId(product.id)
                                  setComboboxOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProductId === product.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{displayName}</span>
                                  {product.name && product.name !== product.sku && (
                                    <span className="text-xs text-muted-foreground">Артикул: {product.sku}</span>
                                  )}
                                </div>
                              </CommandItem>
                            )
                          })
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">Все товары уже добавлены в инвентарь</div>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">Количество на складе</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="minStock">Минимальный уровень остатков</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warehouse">Склад</Label>
              <Select value={warehouseLocation} onValueChange={setWarehouseLocation}>
                <SelectTrigger id="warehouse">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Домашний склад</SelectItem>
                  <SelectItem value="OZON_FBS">Ozon FBS</SelectItem>
                  <SelectItem value="OZON_FBO">Ozon FBO</SelectItem>
                  <SelectItem value="OTHER">Другой</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !selectedProductId}>
              {loading ? "Добавление..." : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
