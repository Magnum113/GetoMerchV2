"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export function SyncOrdersButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/ozon/sync-orders", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Sync failed")
      }

      const data = await response.json()
      console.log("[v0] Sync completed:", data)

      router.refresh()
    } catch (error) {
      console.error("[v0] Sync error:", error)
      alert("Failed to sync orders. Please check your Ozon API credentials.")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button onClick={handleSync} disabled={isSyncing}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Syncing..." : "Sync Orders"}
    </Button>
  )
}
