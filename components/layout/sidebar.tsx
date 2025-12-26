"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  Boxes,
  X,
  GitBranch,
  CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Панель управления", href: "/dashboard", icon: LayoutDashboard },
  { name: "Operations", href: "/operations", icon: CheckSquare },
  { name: "Fulfillment Flow", href: "/fulfillment", icon: GitBranch },
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
          "fixed lg:static inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-white/95 backdrop-blur-sm shadow-soft transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-6">
          <div className="flex items-center gap-3">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%B0%D0%BC%D0%BE%D1%82%D0%B2%D0%B0%D0%BB%D0%BC%D0%BE%D0%B2%D0%B0-27oPvExScf5D2eyb80pRFvrEbarysK.png"
              alt="Geto Logo"
              className="object-contain h-10 w-auto"
            />
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm",
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                )} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-white/80" />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-gray-100 p-4 bg-gray-50/50">
          <div className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-900">Статус системы</span>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/50" />
            </div>
            <p className="text-xs text-gray-600">Все системы работают</p>
          </div>
        </div>
      </div>
    </>
  )
}
