"use client"

import { Bell, Search, Menu, RefreshCw, Package, Brain, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { toast } from "sonner"
import { AISummaryModal } from "@/components/ai/ai-summary-modal"
import { AIChatModal } from "@/components/ai/ai-chat-modal"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isSyncingProducts, setIsSyncingProducts] = useState(false)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)

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
        const syncedOrders = data.items_synced ?? data.orders_synced ?? data.ordersSynced ?? 0
        const errorsCount = data.errors_count ?? 0

        if (errorsCount > 0) {
          toast.warning(`Синхронизировано ${syncedOrders} заказов, но есть ошибки (${errorsCount})`)
        } else {
          toast.success(`Синхронизировано ${syncedOrders} заказов`)
        }
        window.location.reload()
      } else {
        const errorsSample = Array.isArray(data.errors_sample) ? data.errors_sample[0] : null
        toast.error(errorsSample || data.error || "Ошибка синхронизации заказов")
      }
    } catch (error) {
      toast.error("Ошибка синхронизации заказов")
    } finally {
      setIsSyncingOrders(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск товаров, заказов, материалов..."
            className="h-9 rounded-md border-input bg-background pl-9"
          />
        </div>
      </div>

      <div className="hidden items-center gap-2 xl:flex">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncProducts}
          disabled={isSyncingProducts}
          className="gap-2"
        >
          <Package className={`h-4 w-4 ${isSyncingProducts ? "animate-spin" : ""}`} />
          <span>Товары</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncOrders}
          disabled={isSyncingOrders}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncingOrders ? "animate-spin" : ""}`} />
          <span>Заказы</span>
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsAIModalOpen(true)}
          title="ИИ сводка"
        >
          <Brain className="h-5 w-5 text-primary" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsAIChatOpen(true)}
          title="ИИ чат"
        >
          <MessageSquare className="h-5 w-5 text-emerald-600" />
        </Button>

        <Button variant="outline" size="icon" className="hidden md:inline-flex xl:hidden" onClick={handleSyncProducts}>
          <Package className={`h-4 w-4 ${isSyncingProducts ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" size="icon" className="hidden md:inline-flex xl:hidden" onClick={handleSyncOrders}>
          <RefreshCw className={`h-4 w-4 ${isSyncingOrders ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-foreground">
          AD
        </div>
      </div>
      
      <AISummaryModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)}
      />
      <AIChatModal
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
      />
    </header>
  )
}
