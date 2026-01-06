import type { OrderFlowStatus } from "@/lib/types/operations"

export class UXOptimizationService {
  /**
   * Get action-oriented language for UX elements
   * @param context Context of the action
   * @param count Optional count for pluralization
   * @returns Action-oriented text
   */
  getActionText(context: string, count: number = 1): string {
    const actionTexts: Record<string, (count: number) => string> = {
      "ship_orders": (count) => count === 1 ? "Отправить заказ" : "Отправить заказы",
      "produce_items": (count) => count === 1 ? "Произвести товар" : "Произвести товары",
      "order_materials": (count) => count === 1 ? "Заказать материал" : "Заказать материалы",
      "start_production": (count) => count === 1 ? "Запустить производство" : "Запустить производство",
      "create_replenishment": () => "Создать заявку на пополнение",
      "recalculate_statuses": () => "Обновить статусы",
      "view_details": () => "Посмотреть детали",
      "manage_materials": () => "Управлять материалами",
      "edit_recipe": () => "Редактировать рецепт",
      "add_materials": () => "Добавить материалы"
    }

    const actionFn = actionTexts[context]
    return actionFn ? actionFn(count) : context
  }

  /**
   * Get status label with proper formatting
   * @param status Order flow status
   * @returns Formatted status label
   */
  getStatusLabel(status: OrderFlowStatus): string {
    const labels: Record<OrderFlowStatus, string> = {
      "NEW": "Новый",
      "NEED_PRODUCTION": "Произвести",
      "NEED_MATERIALS": "Нужны материалы",
      "IN_PRODUCTION": "В производстве",
      "READY_TO_SHIP": "Готов к отправке",
      "SHIPPED": "Отправлен",
      "DONE": "Завершён",
      "CANCELLED": "Отменён"
    }
    return labels[status] || status
  }

  /**
   * Get status description for tooltips and explanations
   * @param status Order flow status
   * @returns Description text
   */
  getStatusDescription(status: OrderFlowStatus): string {
    const descriptions: Record<OrderFlowStatus, string> = {
      "NEW": "Заказ получен и ожидает обработки",
      "NEED_PRODUCTION": "Товар нужно произвести, все материалы доступны",
      "NEED_MATERIALS": "Не хватает материалов для производства",
      "IN_PRODUCTION": "Товар находится в процессе производства",
      "READY_TO_SHIP": "Товар на складе и готов к отправке клиенту",
      "SHIPPED": "Товар отправлен клиенту",
      "DONE": "Заказ успешно завершён",
      "CANCELLED": "Заказ был отменён"
    }
    return descriptions[status] || "Ожидает обработки"
  }

  /**
   * Get priority label with formatting
   * @param priority Priority level
   * @returns Formatted priority label
   */
  getPriorityLabel(priority: "high" | "normal" | "low"): string {
    const labels: Record<string, string> = {
      "high": "Срочно",
      "normal": "Обычный",
      "low": "Низкий"
    }
    return labels[priority] || priority
  }

  /**
   * Format quantity with units
   * @param quantity Quantity value
   * @param unit Unit of measurement
   * @returns Formatted quantity string
   */
  formatQuantity(quantity: number, unit: string): string {
    return `${quantity} ${unit}`
  }

  /**
   * Format currency value
   * @param amount Amount in rubles
   * @returns Formatted currency string
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  /**
   * Get material deficit description
   * @param materialName Material name
   * @param needed Quantity needed
   * @param have Quantity available
   * @param unit Unit of measurement
   * @returns Formatted deficit description
   */
  getMaterialDeficitDescription(
    materialName: string,
    needed: number,
    have: number,
    unit: string
  ): string {
    const deficit = needed - have
    return `${materialName}: нужно ${needed} ${unit}, есть ${have} ${unit}, не хватает ${deficit} ${unit}`
  }

  /**
   * Get production task description
   * @param productName Product name
   * @param quantity Quantity to produce
   * @param orderCount Number of orders
   * @returns Formatted production description
   */
  getProductionTaskDescription(
    productName: string,
    quantity: number,
    orderCount: number
  ): string {
    const orderText = orderCount === 1 ? "заказ" : orderCount <= 4 ? "заказа" : "заказов"
    return `${productName} • ${quantity} шт • ${orderCount} ${orderText}`
  }

  /**
   * Get order summary for display
   * @param orderNumber Order number
   * @param customerName Customer name
   * @param totalAmount Total amount
   * @param itemCount Number of items
   * @returns Formatted order summary
   */
  getOrderSummary(
    orderNumber: string,
    customerName: string | null,
    totalAmount: number,
    itemCount: number
  ): string {
    const customer = customerName || "Клиент"
    const items = itemCount === 1 ? "товар" : itemCount <= 4 ? "товара" : "товаров"
    return `Заказ ${orderNumber} • ${customer} • ${this.formatCurrency(totalAmount)} • ${itemCount} ${items}`
  }

  /**
   * Get empty state message
   * @param context Context of the empty state
   * @returns Empty state message
   */
  getEmptyStateMessage(context: string): string {
    const messages: Record<string, string> = {
      "ready_to_ship": "Нет заказов готовых к отправке",
      "production_needs": "Нет заказов, готовых к производству",
      "blocked_materials": "Нет заказов, заблокированных из-за материалов",
      "material_deficits": "Все материалы в наличии",
      "replenishment_needs": "Ничего срочно не требуется",
      "production_queue": "Очередь производства пуста",
      "orders": "Нет активных заказов",
      "materials": "Нет материалов в базе"
    }
    return messages[context] || "Нет данных для отображения"
  }

  /**
   * Get success message
   * @param action Completed action
   * @returns Success message
   */
  getSuccessMessage(action: string): string {
    const messages: Record<string, string> = {
      "order_shipped": "Заказ успешно отправлен",
      "production_started": "Производство успешно запущено",
      "status_recalculated": "Статусы успешно обновлены",
      "materials_ordered": "Заявка на пополнение создана",
      "recipe_created": "Рецепт успешно создан",
      "material_added": "Материал успешно добавлен"
    }
    return messages[action] || "Действие успешно выполнено"
  }

  /**
   * Get error message
   * @param errorType Type of error
   * @returns Error message
   */
  getErrorMessage(errorType: string): string {
    const messages: Record<string, string> = {
      "network": "Ошибка соединения с сервером",
      "validation": "Проверьте введённые данные",
      "permission": "Недостаточно прав для этого действия",
      "not_found": "Запрошенные данные не найдены",
      "server": "Ошибка сервера, попробуйте позже"
    }
    return messages[errorType] || "Произошла ошибка"
  }

  /**
   * Get confirmation message
   * @param action Action to be confirmed
   * @param context Additional context
   * @returns Confirmation message
   */
  getConfirmationMessage(action: string, context: string = ""): string {
    const messages: Record<string, (context: string) => string> = {
      "ship_order": (context) => `Вы уверены, что хотите отправить заказ ${context}?`,
      "start_production": (context) => `Запустить производство для ${context}?`,
      "cancel_order": (context) => `Отменить заказ ${context}?`,
      "delete_material": (context) => `Удалить материал ${context}?`,
      "clear_queue": () => "Очистить всю очередь производства?"
    }

    const messageFn = messages[action]
    return messageFn ? messageFn(context) : `Подтвердите действие: ${action}`
  }

  /**
   * Format date for display
   * @param dateString Date string
   * @param format Format type
   * @returns Formatted date string
   */
  formatDate(dateString: string, format: "full" | "short" | "time" = "short"): string {
    const date = new Date(dateString)
    
    switch (format) {
      case "full":
        return date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      case "time":
        return date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })
      default:
        return date.toLocaleDateString('ru-RU')
    }
  }

  /**
   * Get relative time description
   * @param dateString Date string
   * @returns Relative time description (e.g., "2 часа назад")
   */
  getRelativeTime(dateString: string): string {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "только что"
    if (diffMins < 60) return `${diffMins} мин назад`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} ч назад`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays} дн назад`

    const diffMonths = Math.floor(diffDays / 30)
    return `${diffMonths} мес назад`
  }
}

export const uxOptimizationService = new UXOptimizationService()
