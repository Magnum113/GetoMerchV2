"use client"

import { Bell, Search, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
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
