import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ActionCard({
  title,
  subtitle,
  count,
  icon,
  children,
  className,
  actionButton,
  gradientFrom = "from-slate-50",
  gradientTo = "to-white",
  borderColor = "border-slate-200"
}: {
  title: string
  subtitle: string
  count: number | string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
  actionButton?: React.ReactNode
  gradientFrom?: string
  gradientTo?: string
  borderColor?: string
}) {
  return (
    <Card className={cn("border-0 shadow-soft", className)}>
      <CardHeader className={cn(
        "border-b border-gray-100 pb-4",
        `bg-gradient-to-r ${gradientFrom} ${gradientTo}`
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
              <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{count}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {children}
        {actionButton && (
          <div className="mt-4">
            {actionButton}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
