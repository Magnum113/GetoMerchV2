import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, Package, Factory, Truck, AlertTriangle } from "lucide-react"
import type { OrderFlowStatus } from "@/lib/types/operations"

export function OrderTimeline({ 
  currentStatus,
  orderNumber,
  createdAt,
  reasons = []
}: {
  currentStatus: OrderFlowStatus
  orderNumber: string
  createdAt: string
  reasons?: Array<{ status: OrderFlowStatus; reason: string; timestamp?: string }>
}) {
  // Define the order flow stages
  const stages = [
    { status: "NEW", label: "Создан", icon: <Package className="h-5 w-5" /> },
    { status: "NEED_MATERIALS", label: "Материалы", icon: <AlertTriangle className="h-5 w-5" /> },
    { status: "NEED_PRODUCTION", label: "Производство", icon: <Factory className="h-5 w-5" /> },
    { status: "IN_PRODUCTION", label: "В производстве", icon: <Factory className="h-5 w-5" /> },
    { status: "READY_TO_SHIP", label: "Готов", icon: <CheckCircle2 className="h-5 w-5" /> },
    { status: "SHIPPED", label: "Отправлен", icon: <Truck className="h-5 w-5" /> },
    { status: "DONE", label: "Завершён", icon: <CheckCircle2 className="h-5 w-5" /> },
    { status: "CANCELLED", label: "Отменён", icon: <AlertTriangle className="h-5 w-5" /> }
  ]

  // Determine current stage index
  const currentStageIndex = stages.findIndex(stage => stage.status === currentStatus)
  const orderDate = new Date(createdAt)

  // Get reason for current status
  const currentReason = reasons.find(r => r.status === currentStatus)?.reason || 
    getDefaultReason(currentStatus)

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Timeline заказа {orderNumber}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Timeline visualization */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                {orderDate.getDate()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {orderDate.toLocaleDateString('ru-RU', { month: 'short' })}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Заказ создан</div>
              <div className="text-xs text-gray-500">
                {orderDate.toLocaleDateString('ru-RU', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>

          {/* Progress stages */}
          <div className="space-y-4">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStageIndex
              const isCurrent = index === currentStageIndex
              const isFuture = index > currentStageIndex

              // Find reason for this stage
              const stageReason = reasons.find(r => r.status === stage.status)?.reason || 
                (isCurrent ? currentReason : getDefaultReason(stage.status))

              return (
                <div key={stage.status} className="flex items-start gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 text-white' : 
                      isCurrent ? 'bg-blue-500 text-white' : 
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : 
                       isCurrent ? stage.icon : 
                       <Clock className="h-4 w-4" />}
                    </div>
                    {index < stages.length - 1 && (
                      <div className={`h-8 w-px ${
                        isCompleted ? 'bg-green-500' : 
                        isCurrent ? 'bg-blue-500' : 
                        'bg-gray-200'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${
                        isCompleted ? 'text-green-600' : 
                        isCurrent ? 'text-blue-600' : 
                        'text-gray-500'
                      }`}>
                        {stage.label}
                      </span>
                      {isCurrent && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          Текущий этап
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Завершено
                        </Badge>
                      )}
                    </div>
                    <div className={`text-xs ${
                      isCompleted ? 'text-green-600' : 
                      isCurrent ? 'text-blue-600' : 
                      'text-gray-400'
                    }`}>
                      {stageReason}
                    </div>
                    {isFuture && (
                      <div className="text-xs text-gray-400 mt-1">
                        Ожидает выполнения
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Current status explanation */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-800 mb-1">
                  Текущий статус: {getStatusLabel(currentStatus)}
                </div>
                <div className="text-sm text-blue-700 mb-2">
                  {currentReason}
                </div>
                <div className="text-xs text-blue-600">
                  {getNextAction(currentStatus)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getStatusLabel(status: OrderFlowStatus): string {
  const labels: Record<OrderFlowStatus, string> = {
    "NEW": "Новый заказ",
    "NEED_PRODUCTION": "Требует производства",
    "NEED_MATERIALS": "Ожидает материалов",
    "IN_PRODUCTION": "В производстве",
    "READY_TO_SHIP": "Готов к отправке",
    "SHIPPED": "Отправлен",
    "DONE": "Завершён",
    "CANCELLED": "Отменён"
  }
  return labels[status] || status
}

function getDefaultReason(status: OrderFlowStatus): string {
  const reasons: Record<OrderFlowStatus, string> = {
    "NEW": "Заказ получен и ожидает обработки",
    "NEED_PRODUCTION": "Товар нужно произвести, материалы доступны",
    "NEED_MATERIALS": "Не хватает материалов для производства",
    "IN_PRODUCTION": "Товар находится в производстве",
    "READY_TO_SHIP": "Товар на складе, готов к отправке",
    "SHIPPED": "Товар отправлен клиенту",
    "DONE": "Заказ успешно завершён",
    "CANCELLED": "Заказ был отменён"
  }
  return reasons[status] || "Ожидает обработки"
}

function getNextAction(status: OrderFlowStatus): string {
  const actions: Record<OrderFlowStatus, string> = {
    "NEW": "Система автоматически определит сценарий исполнения",
    "NEED_PRODUCTION": "Запустите производство когда будете готовы",
    "NEED_MATERIALS": "Закажите недостающие материалы у поставщиков",
    "IN_PRODUCTION": "Дождитесь завершения производства",
    "READY_TO_SHIP": "Отправьте заказ клиенту",
    "SHIPPED": "Заказ в пути к клиенту",
    "DONE": "Заказ завершён, нет действий требуется",
    "CANCELLED": "Заказ отменён, нет действий требуется"
  }
  return actions[status] || "Нет действий требуется"
}

