import { NextRequest } from "next/server"
import { PUT } from "@/app/api/production/recipes/[id]/route"
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
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn(),
          catch: jest.fn(),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn(),
          catch: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        then: jest.fn(),
        catch: jest.fn(),
      })),
    })),
  })),
}))

describe("PUT /api/production/recipes/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should update recipe and handle recipe_products correctly", async () => {
    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "recipe_products") {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "recipes") {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "recipe_materials") {
          return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/recipes/1", {
      method: "PUT",
      body: JSON.stringify({
        name: "Updated Recipe",
        description: "Updated description",
        production_time_minutes: 30,
        materials: [
          { material_definition_id: "mat-1", quantity_required: 2 },
          { material_definition_id: "mat-2", quantity_required: 1 },
        ],
        products: ["prod-1", "prod-2", "prod-3"],
      }),
    })

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("should return error when required fields are missing", async () => {
    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
      })),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/recipes/1", {
      method: "PUT",
      body: JSON.stringify({
        // Missing required fields
        materials: [],
      }),
    })

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  it("should handle errors when products are already associated with other recipes", async () => {
    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "recipe_products") {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ 
              data: [{ recipe_id: "existing-recipe-1" }], 
              error: null 
            }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/recipes/1", {
      method: "PUT",
      body: JSON.stringify({
        name: "Test Recipe",
        materials: [
          { material_definition_id: "mat-1", quantity_required: 1 },
        ],
        products: ["prod-1"],
      }),
    })

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain("уже связаны с рецептами")
  })

  it("should delete old recipe_products and insert new ones", async () => {
    const deleteSpy = jest.fn().mockResolvedValue({ error: null })
    const insertSpy = jest.fn().mockResolvedValue({ error: null })

    const mockSupabase = {
      from: jest.fn((table) => {
        if (table === "recipe_products") {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: deleteSpy,
            eq: jest.fn().mockReturnValue({ delete: deleteSpy }),
          }
        }
        if (table === "recipes") {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "recipe_materials") {
          return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
            insert: insertSpy,
          }
        }
        return { select: jest.fn().mockReturnThis() }
      }),
    }

    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

    const request = new NextRequest("http://localhost/api/production/recipes/1", {
      method: "PUT",
      body: JSON.stringify({
        name: "Test Recipe",
        materials: [
          { material_definition_id: "mat-1", quantity_required: 1 },
        ],
        products: ["prod-1", "prod-2"],
      }),
    })

    const response = await PUT(request, { params: Promise.resolve({ id: "1" }) })
    const data = await response.json()

    expect(deleteSpy).toHaveBeenCalled()
    expect(insertSpy).toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

