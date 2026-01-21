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
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6 shadow-soft">
      <div className="flex flex-1 items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden h-9 w-9 hover:bg-gray-100" 
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </Button>
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Поиск товаров, заказов, материалов..."
            className="pl-10 h-10 bg-gray-50/80 border-gray-200 rounded-lg focus:bg-white focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncProducts}
          disabled={isSyncingProducts}
          className="gap-2 h-9 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
        >
          <Package className={`h-4 w-4 ${isSyncingProducts ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Товары</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncOrders}
          disabled={isSyncingOrders}
          className="gap-2 h-9 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncingOrders ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Заказы</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-blue-50 relative group"
          onClick={() => setIsAIModalOpen(true)}
        >
          <Brain className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-emerald-50 relative group"
          onClick={() => setIsAIChatOpen(true)}
        >
          <MessageSquare className="h-5 w-5 text-emerald-600 group-hover:text-emerald-700" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 relative hover:bg-gray-100 group"
        >
          <Bell className="h-5 w-5 text-gray-600 group-hover:text-gray-700" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 shadow-sm" />
        </Button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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
