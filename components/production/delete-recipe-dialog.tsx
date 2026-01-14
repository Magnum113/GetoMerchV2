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

type DeleteRecipeDialogProps = {
  recipeId: string
  recipeName: string
  onSuccess?: () => void
}

export function DeleteRecipeDialog({ 
  recipeId, 
  recipeName, 
  onSuccess
}: DeleteRecipeDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    setIsSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/production/recipes/${recipeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось удалить рецепт")
      }

      // Refresh the page to update the recipe list
      router.refresh()
      
      if (onSuccess) {
        onSuccess()
      }
      
      setOpen(false)
    } catch (err) {
      console.error("[v0] Ошибка удаления рецепта:", err)
      setError(err instanceof Error ? err.message : "Не удалось удалить рецепт")
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
          title="Удалить рецепт"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить рецепт</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить этот рецепт?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Trash2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Рецепт: {recipeName}</p>
              <p className="text-sm text-muted-foreground">
                После удаления рецепт будет деактивирован и больше не будет доступен для производства.
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
