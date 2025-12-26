"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Brain, Loader2, RefreshCw, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface AISummaryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AISummaryModal({ isOpen, onClose }: AISummaryModalProps) {
  const [summary, setSummary] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAISummary = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Ошибка получения сводки от ИИ")
      }

      const data = await response.json()
      setSummary(data.summary || "Нет данных для анализа")
    } catch (err) {
      console.error("AI Summary Error:", err)
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
      toast.error("Не удалось получить сводку от ИИ")
    } finally {
      setIsLoading(false)
    }
  }

  // Автоматически получаем сводку при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchAISummary()
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            ИИ Сводка на сегодня
          </DialogTitle>
          <DialogDescription>
            Краткий анализ текущей ситуации в вашем бизнесе
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-muted-foreground">ИИ анализирует данные...</p>
              <p className="text-sm text-muted-foreground text-center">
                Это может занять несколько секунд
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">Ошибка: {error}</p>
              <Button
                onClick={fetchAISummary}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Попробовать снова
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                {summary.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-3 text-gray-700">
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={fetchAISummary}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Обновить сводку
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
