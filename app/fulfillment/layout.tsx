import type React from "react"
import { AppLayout } from "@/components/layout/app-layout"

export const metadata = {
  title: "Fulfillment Flow - Geto",
  description: "Контроль исполнения заказов",
}

export default function FulfillmentLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
