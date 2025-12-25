import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productionId } = body

    if (!productionId) {
      return NextResponse.json({ success: false, error: "Missing production ID" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update production status to in_progress
    const { error } = await supabase
      .from("production_queue")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productionId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Start production failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start production",
      },
      { status: 500 },
    )
  }
}
