"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function SyncProductsButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/ozon/sync-products", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка синхронизации")
      }

      toast({
        title: "Синхронизация завершена",
        description: `Импортировано товаров: ${data.items_synced}`,
      })

      router.refresh()
    } catch (error) {
      console.error("[v0] Sync error:", error)

      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"

      toast({
        variant: "destructive",
        title: "Ошибка синхронизации",
        description: errorMessage,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Синхронизация..." : "Синхронизировать с Ozon"}
    </Button>
  )
}
