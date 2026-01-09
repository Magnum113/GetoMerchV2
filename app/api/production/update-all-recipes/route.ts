import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Endpoint to completely update all recipes:
 * 1. Deletes all existing recipes (soft delete)
 * 2. Creates new recipes based on current product groupings
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { confirmUpdate = false, backupFirst = true } = body

    // Safety check - require explicit confirmation for complete recipe update
    if (!confirmUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: "Для полного обновления рецептов требуется явное подтверждение. Установите confirmUpdate=true"
        },
        { status: 400 },
      )
    }

    // Step 1: Delete all existing recipes (soft delete)
    const deleteResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/production/recipes/bulk-delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          backupFirst: backupFirst,
        }),
      }
    )

    const deleteResult = await deleteResponse.json()

    if (!deleteResult.success) {
      console.error("[v0] Ошибка удаления существующих рецептов:", deleteResult.error)
      return NextResponse.json(
        {
          success: false,
          error: `Не удалось удалить существующие рецепты: ${deleteResult.error}`,
          step: "delete",
        },
        { status: 500 },
      )
    }

    console.log(
      `[v0] Успешно удалено ${deleteResult.deletedCount} существующих рецептов`
    )

    // Step 2: Create new recipes based on current product groupings
    const createResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/production/auto-create-recipes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    )

    const createResult = await createResponse.json()

    if (!createResult.success) {
      console.error("[v0] Ошибка создания новых рецептов:", createResult.error)
      return NextResponse.json(
        {
          success: false,
          error: `Не удалось создать новые рецепты: ${createResult.error}`,
          step: "create",
          deletedCount: deleteResult.deletedCount,
        },
        { status: 500 },
      )
    }

    console.log(
      `[v0] Успешно создано ${createResult.created} новых рецептов для ${createResult.totalGroups} групп`
    )

    return NextResponse.json({
      success: true,
      message: `Успешно обновлены рецепты: удалено ${deleteResult.deletedCount}, создано ${createResult.created}`,
      deletedCount: deleteResult.deletedCount,
      createdCount: createResult.created,
      totalGroups: createResult.totalGroups,
      errors: createResult.errors,
      recipes: createResult.recipes,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Ошибка полного обновления рецептов:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}