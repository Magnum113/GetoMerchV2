"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"

type CompleteProductionButtonProps = {
  productionId: string
  productId: string
  quantity: number
  productName: string
}

export function CompleteProductionButton({
  productionId,
  productId,
  quantity,
  productName,
}: CompleteProductionButtonProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const router = useRouter()

  const handleComplete = async () => {
    if (!confirm(`Complete production of ${quantity} units of ${productName}?`)) return

    setIsCompleting(true)
    try {
      const response = await fetch("/api/production/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, productId, quantity }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to complete production")
      }

      router.refresh()
    } catch (error) {
      console.error("[v0] Complete production error:", error)
      alert(error instanceof Error ? error.message : "Failed to complete production. Please try again.")
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <Button size="sm" variant="default" onClick={handleComplete} disabled={isCompleting}>
      <CheckCircle className="h-3 w-3 mr-1" />
      {isCompleting ? "Completing..." : "Complete"}
    </Button>
  )
}
