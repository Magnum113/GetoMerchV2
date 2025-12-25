"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, Warehouse, Factory, ShoppingCart, BarChart3, Settings, Boxes, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Панель управления", href: "/dashboard", icon: LayoutDashboard },
  { name: "Каталог Ozon", href: "/catalog", icon: Package },
  { name: "Остатки", href: "/inventory", icon: Warehouse },
  { name: "Материалы", href: "/materials", icon: Boxes },
  { name: "Производство", href: "/production", icon: Factory },
  { name: "Заказы", href: "/orders", icon: ShoppingCart },
  { name: "Аналитика", href: "/analytics", icon: BarChart3 },
  { name: "Настройки", href: "/settings", icon: Settings },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}

      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-white shadow-sm transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center">
            <img
              src="/images/d0-b0-d0-bc-d0-be-d1-82-d0-b2-d0-b0-d0-bb-d0-bc-d0-be-d0-b2-d0-b0.png"
              alt="Geto Logo"
              className="object-contain py-0.5 mx-1 w-[98px] h-[84px]"
            />
            <span className="ml-2 text-lg font-semibold">{""}</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-white shadow-sm" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <div className="text-xs text-gray-600">
            <div className="font-medium text-gray-900">Статус системы</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Все системы работают</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
