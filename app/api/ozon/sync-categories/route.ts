import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { OzonClient } from "@/lib/ozon/client"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const ozonClient = new OzonClient()

    console.log("[v0] Начало синхронизации категорий Ozon...")

    // Получаем дерево категорий
    const response = await ozonClient.getCategoryTree()

    if (!response.result || !Array.isArray(response.result)) {
      throw new Error("Не удалось получить дерево категорий от Ozon API")
    }

    const categories = response.result
    let syncedCount = 0
    let skippedCount = 0

    console.log(`[v0] Получено ${categories.length} категорий от Ozon`)

    if (categories.length > 0) {
      console.log("[v0] Пример первой категории:", JSON.stringify(categories[0]).substring(0, 300))
    }

    // Функция для рекурсивной обработки категорий
    const processCategory = async (category: any, parentId: number | null = null, depth = 0) => {
      try {
        if (!category || typeof category !== "object") {
          console.log(`[v0] [Глубина ${depth}] Пропускаем: не объект`)
          skippedCount++
          return
        }

        const categoryId = category?.description_category_id
        const categoryName = category?.category_name || "Без названия"

        console.log(
          `[v0] [Глубина ${depth}] Проверка: ID=${categoryId} (тип: ${typeof categoryId}), Название="${categoryName}"`,
        )

        if (
          categoryId === null ||
          categoryId === undefined ||
          categoryId === "" ||
          (typeof categoryId === "number" && isNaN(categoryId))
        ) {
          console.log(
            `[v0] [Глубина ${depth}] ПРОПУСКАЕМ категорию без валидного ID: "${categoryName}", ID=${categoryId}`,
          )
          skippedCount++

          // Обрабатываем дочерние категории с текущим parentId (не undefined)
          if (category?.children && Array.isArray(category.children) && category.children.length > 0) {
            console.log(
              `[v0] [Глубина ${depth}] Обрабатываем ${category.children.length} дочерних категорий (без ID родителя)`,
            )
            for (const child of category.children) {
              await processCategory(child, parentId, depth + 1)
            }
          }
          return
        }

        let numericCategoryId: number
        try {
          numericCategoryId = Number(categoryId)
          if (isNaN(numericCategoryId)) {
            throw new Error(`ID не является числом: ${categoryId}`)
          }
        } catch (e) {
          console.log(`[v0] [Глубина ${depth}] Ошибка преобразования ID в число: ${categoryId}`)
          skippedCount++
          return
        }

        const dataToInsert = {
          category_id: numericCategoryId,
          category_name: categoryName,
          parent_id: parentId,
          disabled: category.disabled || false,
          updated_at: new Date().toISOString(),
        }

        if (
          dataToInsert.category_id === null ||
          dataToInsert.category_id === undefined ||
          isNaN(dataToInsert.category_id)
        ) {
          console.error(
            `[v0] [Глубина ${depth}] КРИТИЧНО: category_id невалидный перед upsert:`,
            dataToInsert.category_id,
          )
          skippedCount++
          return
        }

        console.log(`[v0] [Глубина ${depth}] Готов к сохранению:`, JSON.stringify(dataToInsert))

        const { error } = await supabase.from("ozon_categories").upsert(dataToInsert, { onConflict: "category_id" })

        if (error) {
          console.error(`[v0] [Глубина ${depth}] Ошибка сохранения категории ${numericCategoryId}:`, error.message)
          console.error(`[v0] [Глубина ${depth}] Данные которые пытались сохранить:`, JSON.stringify(dataToInsert))
        } else {
          syncedCount++
          console.log(`[v0] [Глубина ${depth}] ✓ Категория ${numericCategoryId} успешно сохранена`)
        }

        if (category?.children && Array.isArray(category.children) && category.children.length > 0) {
          console.log(
            `[v0] [Глубина ${depth}] Обрабатываем ${category.children.length} дочерних категорий для ID=${numericCategoryId}`,
          )
          for (const child of category.children) {
            await processCategory(child, numericCategoryId, depth + 1)
          }
        }
      } catch (error) {
        console.error(`[v0] [Глубина ${depth}] Исключение при обработке категории:`, error)
        console.error(
          `[v0] [Глубина ${depth}] Данные категории:`,
          category ? JSON.stringify(category).substring(0, 200) : "null",
        )
      }
    }

    // Обрабатываем все категории верхнего уровня
    for (const category of categories) {
      await processCategory(category, null, 0)
    }

    console.log("[v0] ========================================")
    console.log("[v0] Синхронизация категорий завершена")
    console.log("[v0] ✓ Синхронизировано категорий:", syncedCount)
    console.log("[v0] ⊗ Пропущено категорий без ID:", skippedCount)
    console.log("[v0] ========================================")

    return NextResponse.json({
      success: true,
      categories_synced: syncedCount,
      categories_skipped: skippedCount,
    })
  } catch (error) {
    console.error("[v0] Ошибка синхронизации категорий:", error)

    const errorMessage = error instanceof Error ? error.message : "Ошибка синхронизации категорий"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
