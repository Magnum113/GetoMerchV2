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
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"

type MaterialAdjustmentDialogProps = {
  materialId: string
  materialName: string
}

export function MaterialAdjustmentDialog({ materialId, materialName }: MaterialAdjustmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/materials/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          adjustment: Number.parseFloat(adjustment),
          reason,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось скорректировать запас")
      }

      setOpen(false)
      setAdjustment("")
      setReason("")
      router.refresh()
    } catch (error) {
      console.error("[v0] Ошибка корректировки материала:", error)
      alert(error instanceof Error ? error.message : "Не удалось скорректировать запас. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Корректировать
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Корректировка запаса</DialogTitle>
          <DialogDescription>Ручная корректировка количества материала: {materialName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment">Изменение количества</Label>
            <Input
              id="adjustment"
              type="number"
              step="0.01"
              placeholder="Введите положительное или отрицательное число"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Используйте положительные числа для увеличения, отрицательные для уменьшения
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Причина</Label>
            <Textarea
              id="reason"
              placeholder="Введите причину корректировки..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !adjustment}>
            {isSubmitting ? "Корректировка..." : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
