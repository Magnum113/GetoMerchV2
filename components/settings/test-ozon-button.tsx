"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, TestTube } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TestOzonButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    itemsReturned?: number
    error?: string
    fullResponseSnippet?: string
  } | null>(null)
  const { toast } = useToast()

  const handleTest = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/ozon/test", {
        method: "POST",
      })

      const data = await response.json()

      setTestResult(data)

      if (data.success) {
        toast({
          title: "Тест успешен",
          description: `API вернул ${data.itemsReturned} товаров на первой странице`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Тест не прошёл",
          description: data.error,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ошибка сети"
      setTestResult({
        success: false,
        error: errorMessage,
      })
      toast({
        variant: "destructive",
        title: "Ошибка теста",
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full bg-white hover:bg-gray-50">
          <TestTube className="h-4 w-4" />
          Тест Ozon API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Диагностика Ozon API</DialogTitle>
          <DialogDescription>Проверка подключения и получения данных из Ozon API</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={handleTest} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Тестирование...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Запустить тест
              </>
            )}
          </Button>

          {testResult && (
            <div className="space-y-3">
              <div
                className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
              >
                <div className={`font-medium ${testResult.success ? "text-green-900" : "text-red-900"}`}>
                  {testResult.success ? "✓ API работает" : "✗ Ошибка API"}
                </div>
                {testResult.itemsReturned !== undefined && (
                  <div className="text-sm mt-2 text-gray-700">Товаров получено: {testResult.itemsReturned}</div>
                )}
                {testResult.error && <div className="text-sm mt-2 text-red-700">{testResult.error}</div>}
              </div>

              {testResult.fullResponseSnippet && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">Ответ API (первые 2000 символов):</div>
                  <pre className="p-3 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto max-h-64 text-gray-800">
                    {testResult.fullResponseSnippet}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
