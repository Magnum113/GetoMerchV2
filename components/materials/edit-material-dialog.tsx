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
import { useRouter } from "next/navigation"
import { Edit } from "lucide-react"
import { toast } from "sonner"

type EditMaterialDialogProps = {
  materialDefinitionId: string
  materialName: string
  currentAttributes: any
  currentUnit: string
}

export function EditMaterialDialog({
  materialDefinitionId,
  materialName,
  currentAttributes,
  currentUnit,
}: EditMaterialDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(materialName)
  const [unit, setUnit] = useState(currentUnit)
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      setName(materialName)
      setUnit(currentUnit)
    }
  }, [open, materialName, currentUnit])

  const handleSubmit = async () => {
    if (!name || !unit) {
      toast.error("Заполните обязательные поля: Название и Единица измерения")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/materials/definitions/${materialDefinitionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit,
          description: description || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось обновить материал")
      }

      toast.success("Материал успешно обновлен!")
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка обновления материала:", error)
      toast.error(error instanceof Error ? error.message : "Не удалось обновить материал. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Редактировать материал">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать материал</DialogTitle>
          <DialogDescription>Измените информацию о материале</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              placeholder="Например: Футболка белая S"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Единица измерения *</Label>
            <Input
              id="unit"
              placeholder="шт"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Например: шт, кг, м</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Описание материала (необязательно)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name || !unit}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

