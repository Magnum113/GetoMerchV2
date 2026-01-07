import { NextRequest } from "next/server"
import { POST } from "@/app/api/production/auto-create-recipes/route"
import { createClient } from "@/lib/supabase/server"

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn(),
          catch: jest.fn(),
        })),
      })),
    })),
  })),
}))

describe("POST /api/production/auto-create-recipes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should parse product type, color, and size correctly", async () => {
    // Mock product data
    const mockProducts = [
      { id: "1", name: "Худи черное XL", sku: "HOD-001" },
      { id: "2", name: "Футболка белая M", sku: "TSH-001" },
      { id: "3", name: "Свитшот синий S", sku: "SWT-001" },
    ]

    // Mock Supabase response
    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "products") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockProducts, error: null }),
          }
        }
        if (table === "material_definitions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [{ id: "mat-1" }], error: null }),
            ilike: jest.fn().mockResolvedValue({ data: [{ id: "mat-2" }], error: null }),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
          }
        }
        if (table === "recipes") {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: "recipe-1" }, error: null }),
          }
        }
        if (table === "recipe_products") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            in: jest.fn().mockReturnThis(),
          }
        }
        if (table === "recipe_materials") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/auto-create-recipes", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.created).toBeGreaterThan(0)
  })

  it("should handle errors when no products are found", async () => {
    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "products") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: { message: "No products found" } }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/auto-create-recipes", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  it("should map product types to materials correctly", async () => {
    const mockProducts = [
      { id: "1", name: "Худи черное XL", sku: "HOD-001" },
    ]

    const mockMaterialDefinitions = [
      { id: "mat-hoodie", name: "Худи черное", attributes: { material_type: "hoodie" } },
    ]

    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "products") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockProducts, error: null }),
          }
        }
        if (table === "material_definitions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn((field, value) => {
              if (field === "attributes->>material_type" && value === "hoodie") {
                return { limit: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: mockMaterialDefinitions[0], error: null }) }
              }
              return { limit: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
            }),
            ilike: jest.fn().mockResolvedValue({ data: null, error: null }),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
          }
        }
        if (table === "recipes") {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: "recipe-1" }, error: null }),
          }
        }
        if (table === "recipe_products") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            in: jest.fn().mockReturnThis(),
          }
        }
        if (table === "recipe_materials") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/auto-create-recipes", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.created).toBe(1)
  })
})
