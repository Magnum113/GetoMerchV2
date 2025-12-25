"use client"

import { Button } from "@/components/ui/button"
import { FolderTree } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function SyncCategoriesButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/ozon/sync-categories", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        alert(`Успешно синхронизировано ${data.categories_synced} категорий`)
        router.refresh()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error("Ошибка синхронизации категорий:", error)
      alert("Ошибка синхронизации категорий")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button onClick={handleSync} disabled={isSyncing} variant="outline" className="w-full bg-transparent">
      <FolderTree className="mr-2 h-4 w-4" />
      {isSyncing ? "Синхронизация категорий..." : "Синхронизировать категории Ozon"}
    </Button>
  )
}
