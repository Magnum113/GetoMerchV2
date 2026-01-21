import { NextRequest } from "next/server"
import { POST } from "@/app/api/operations/ship-order/route"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

describe("POST /api/operations/ship-order", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("updates order status and returns success", async () => {
    const ordersEqMock = jest.fn().mockResolvedValue({ error: null })
    const ordersUpdateMock = jest.fn(() => ({ eq: ordersEqMock }))
    const orderItemsEqMock = jest.fn().mockResolvedValue({
      data: [{ product_id: "prod-1", quantity: 2 }],
    })
    const orderItemsSelectMock = jest.fn(() => ({ eq: orderItemsEqMock }))
    const rpcMock = jest.fn().mockResolvedValue({ data: null, error: null })

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table) => {
        if (table === "orders") {
          return { update: ordersUpdateMock }
        }
        if (table === "order_items") {
          return { select: orderItemsSelectMock }
        }
        return {}
      }),
      rpc: rpcMock,
    })

    const request = new NextRequest("http://localhost/api/operations/ship-order", {
      method: "POST",
      body: JSON.stringify({ orderId: "order-1" }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(ordersUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ order_flow_status: "SHIPPED" }),
    )
    expect(rpcMock).toHaveBeenCalledWith("update_inventory_on_ship", {
      product_id: "prod-1",
      quantity: 2,
    })
  })
})
