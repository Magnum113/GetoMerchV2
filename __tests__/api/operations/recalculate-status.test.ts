import { POST } from "@/app/api/operations/recalculate-status/route"
import { operationsService } from "@/lib/services/operations-service"

jest.mock("@/lib/services/operations-service", () => ({
  operationsService: {
    updateAllOrdersOperationalStatus: jest.fn(),
    markOldOrdersAsDone: jest.fn(),
  },
}))

describe("POST /api/operations/recalculate-status", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns success when services complete", async () => {
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(operationsService.updateAllOrdersOperationalStatus).toHaveBeenCalled()
    expect(operationsService.markOldOrdersAsDone).toHaveBeenCalled()
  })

  it("returns error when recalculation fails", async () => {
    ;(operationsService.updateAllOrdersOperationalStatus as jest.Mock).mockRejectedValueOnce(new Error("boom"))

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe("boom")
  })
})
