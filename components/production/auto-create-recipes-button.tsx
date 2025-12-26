"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function AutoCreateRecipesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    if (!confirm("Создать рецепты автоматически для всех товаров? Товары будут сгруппированы по типу, цвету и размеру.")) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/production/auto-create-recipes", { method: "POST" })
      const data = await response.json()
      if (data.success) {
        alert(`Создано ${data.created} рецептов для ${data.totalGroups} групп товаров${data.errors > 0 ? `\nОшибок: ${data.errors}` : ""}`)
        router.refresh()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error("[v0] Ошибка автосоздания рецептов:", error)
      alert("Произошла ошибка при создании рецептов")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Создание..." : "Автосоздание рецептов"}
    </Button>
  )
}

