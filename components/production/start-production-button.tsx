"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { useRouter } from "next/navigation"

type StartProductionButtonProps = {
  productionId: string
  productName: string
}

export function StartProductionButton({ productionId, productName }: StartProductionButtonProps) {
  const [isStarting, setIsStarting] = useState(false)
  const router = useRouter()

  const handleStart = async () => {
    if (!confirm(`Start production for ${productName}?`)) return

    setIsStarting(true)
    try {
      const response = await fetch("/api/production/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId }),
      })

      if (!response.ok) {
        throw new Error("Failed to start production")
      }

      router.refresh()
    } catch (error) {
      console.error("[v0] Start production error:", error)
      alert("Failed to start production. Please try again.")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Button size="sm" onClick={handleStart} disabled={isStarting}>
      <Play className="h-3 w-3 mr-1" />
      {isStarting ? "Starting..." : "Start"}
    </Button>
  )
}
