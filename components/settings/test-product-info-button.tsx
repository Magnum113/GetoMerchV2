"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, TestTube } from "lucide-react"
import { toast } from "sonner"

export function TestProductInfoButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  const handleTest = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/ozon/test-product-info", {
        method: "POST",
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast.success("Тест успешно выполнен")
      } else {
        toast.error(data.error || "Тест не прошёл")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка теста"
      toast.error(message)
      setResult({ error: message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleTest} disabled={isLoading} variant="outline" className="w-full bg-transparent">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
        Тест product/info/list на 1 товар
      </Button>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <pre className="text-xs overflow-auto max-h-96 text-gray-800">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
