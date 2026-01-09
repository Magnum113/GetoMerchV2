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
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

type DeleteQueueItemDialogProps = {
  productionId: string
  productName: string
  onSuccess?: () => void
}

export function DeleteQueueItemDialog({ 
  productionId, 
  productName, 
  onSuccess
}: DeleteQueueItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    setIsSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/production/queue/${productionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось удалить элемент очереди")
      }

      // Refresh the page to update the queue
      router.refresh()
      
      if (onSuccess) {
        onSuccess()
      }
      
      setOpen(false)
    } catch (err) {
      console.error("[v0] Ошибка удаления элемента очереди:", err)
      setError(err instanceof Error ? err.message : "Не удалось удалить элемент очереди")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Удалить из очереди"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить из очереди</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить этот элемент из очереди производства?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Trash2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Товар: {productName}</p>
              <p className="text-sm text-muted-foreground">
                После удаления элемент будет полностью удалён из очереди производства.
                <span className="block mt-1">Связанные заказы будут обновлены автоматически.</span>
              </p>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <p className="font-medium">Ошибка:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
