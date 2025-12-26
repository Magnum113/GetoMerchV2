"use client"

import { Bell, Search, Menu, RefreshCw, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { toast } from "sonner"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isSyncingProducts, setIsSyncingProducts] = useState(false)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)

  const handleSyncProducts = async () => {
    setIsSyncingProducts(true)
    try {
      const response = await fetch("/api/ozon/sync-products", {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok) {
        toast.success(`Синхронизировано ${data.itemsSynced || 0} товаров`)
        window.location.reload()
      } else {
        toast.error(data.error || "Ошибка синхронизации товаров")
      }
    } catch (error) {
      toast.error("Ошибка синхронизации товаров")
    } finally {
      setIsSyncingProducts(false)
    }
  }

  const handleSyncOrders = async () => {
    setIsSyncingOrders(true)
    try {
      const response = await fetch("/api/ozon/sync-orders", {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok) {
        toast.success(`Синхронизировано ${data.ordersSynced || 0} заказов`)
        window.location.reload()
      } else {
        toast.error(data.error || "Ошибка синхронизации заказов")
      }
    } catch (error) {
      toast.error("Ошибка синхронизации заказов")
    } finally {
      setIsSyncingOrders(false)
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
      <div className="flex flex-1 items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden hover:bg-gray-100" onClick={onMenuClick}>
          <Menu className="h-5 w-5 text-gray-700" />
        </Button>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Поиск товаров, заказов, материалов..."
            className="pl-9 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncProducts}
          disabled={isSyncingProducts}
          className="gap-2 bg-transparent"
        >
          <Package className={`h-4 w-4 ${isSyncingProducts ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Товары</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncOrders}
          disabled={isSyncingOrders}
          className="gap-2 bg-transparent"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncingOrders ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Заказы</span>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-700" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
          AD
        </div>
      </div>
    </header>
  )
}
