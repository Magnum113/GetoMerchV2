import type { OperationalStatus, OrderFlowStatus } from "@/lib/types/operations"

export function mapOperationalToOrderFlowStatus(operationalStatus: OperationalStatus): OrderFlowStatus {
  switch (operationalStatus) {
    case "READY_TO_SHIP":
      return "READY_TO_SHIP"
    case "WAITING_FOR_PRODUCTION":
      return "NEED_PRODUCTION"
    case "WAITING_FOR_MATERIALS":
      return "NEED_MATERIALS"
    case "IN_PRODUCTION":
      return "IN_PRODUCTION"
    case "SHIPPED":
      return "SHIPPED"
    case "DONE":
      return "DONE"
    case "CANCELLED":
      return "CANCELLED"
    case "BLOCKED":
      return "CANCELLED"
    case "PENDING":
    default:
      return "NEW"
  }
}
