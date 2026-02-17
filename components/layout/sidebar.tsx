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
      {isOpen && <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={onClose} />}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%B0%D0%BC%D0%BE%D1%82%D0%B2%D0%B0%D0%BB%D0%BC%D0%BE%D0%B2%D0%B0-27oPvExScf5D2eyb80pRFvrEbarysK.png"
              alt="Geto Logo"
              className="h-9 w-auto object-contain"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Geto Manager</p>
              <p className="text-xs text-muted-foreground">Ozon control panel</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="flex-1">{item.name}</span>
                {isActive && <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Статус системы</span>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground">Все системы работают</p>
          </div>
        </div>
      </div>
    </>
  )
}
