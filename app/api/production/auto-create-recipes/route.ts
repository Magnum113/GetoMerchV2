import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Функция для парсинга типа товара из названия
function parseProductType(name: string): string {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("hoodie") && lowerName.includes("укороченное")) {
    return "cropped_hoodie"
  }
  if (lowerName.includes("hoodie") || lowerName.includes("худи")) {
    return "hoodie"
  }
  if (lowerName.includes("tshirt") || lowerName.includes("футболка") || lowerName.includes("print") || lowerName.includes("emb")) {
    return "tshirt"
  }
  if (lowerName.includes("sweatshirt") || lowerName.includes("свитшот")) {
    return "sweatshirt"
  }
  return "unknown"
}

// Функция для парсинга цвета из названия
function parseColor(name: string): string {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("black") || lowerName.includes("черн")) {
    return "black"
  }
  if (lowerName.includes("white") || lowerName.includes("бел")) {
    return "white"
  }
  if (lowerName.includes("blue") || lowerName.includes("син")) {
    return "blue"
  }
  if (lowerName.includes("gray") || lowerName.includes("grey") || lowerName.includes("сер")) {
    return "gray"
  }
  return "unknown"
}

// Функция для парсинга размера из названия
function parseSize(name: string): string {
  const sizes = ["XXL", "XL", "L", "M", "S"]
  for (const size of sizes) {
    if (name.includes(`-${size}`) || name.includes(` ${size}`) || name.endsWith(size)) {
      return size
    }
  }
  return "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Получаем все активные товары
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("is_active", true)

    if (productsError || !products) {
      console.error("[v0] Ошибка получения товаров:", productsError)
      return NextResponse.json(
        { success: false, error: productsError?.message || "Не удалось получить товары" },
        { status: 500 },
      )
    }

    // Группируем товары по типу, цвету и размеру
    const groups = new Map<string, Array<{ id: string; name: string; sku: string }>>()

    for (const product of products) {
      const type = parseProductType(product.name)
      const color = parseColor(product.name)
      const size = parseSize(product.name)
      const groupKey = `${type}_${color}_${size}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(product)
    }

    const createdRecipes: Array<{ groupKey: string; recipeId: string; productCount: number }> = []
    const errors: Array<{ groupKey: string; error: string }> = []

    // Получаем список материалов для создания базовых рецептов
    const { data: materials } = await supabase.from("materials").select("id, name").limit(10)

    // Создаем рецепт для каждой группы
    for (const [groupKey, groupProducts] of groups.entries()) {
      if (groupProducts.length === 0) continue

      const [type, color, size] = groupKey.split("_")
      const typeNames: Record<string, string> = {
        tshirt: "Футболка",
        hoodie: "Худи",
        cropped_hoodie: "Худи укороченное",
        sweatshirt: "Свитшот",
        unknown: "Товар",
      }
      const colorNames: Record<string, string> = {
        black: "Черная",
        white: "Белая",
        blue: "Синяя",
        gray: "Серая",
        unknown: "",
      }
      const sizeNames: Record<string, string> = {
        XXL: "XXL",
        XL: "XL",
        L: "L",
        M: "M",
        S: "S",
        unknown: "",
      }

      const recipeName = `Рецепт: ${typeNames[type] || "Товар"} ${colorNames[color] || ""} ${sizeNames[size] || ""}`.trim()

      try {
        // Проверяем, нет ли уже рецепта для этих товаров
        const productIds = groupProducts.map((p) => p.id)
        const { data: existingRecipes } = await supabase
          .from("recipe_products")
          .select("recipe_id")
          .in("product_id", productIds)

        if (existingRecipes && existingRecipes.length > 0) {
          errors.push({
            groupKey,
            error: `Товары уже связаны с рецептами`,
          })
          continue
        }

        // Создаем рецепт
        const { data: recipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            name: recipeName,
            description: `Автоматически созданный рецепт для группы: ${groupKey} (${groupProducts.length} товаров)`,
            is_active: true,
          })
          .select()
          .single()

        if (recipeError || !recipe) {
          errors.push({
            groupKey,
            error: recipeError?.message || "Не удалось создать рецепт",
          })
          continue
        }

        // Связываем рецепт с товарами
        const recipeProducts = productIds.map((productId) => ({
          recipe_id: recipe.id,
          product_id: productId,
        }))

        const { error: productsError } = await supabase.from("recipe_products").insert(recipeProducts)

        if (productsError) {
          await supabase.from("recipes").delete().eq("id", recipe.id)
          errors.push({
            groupKey,
            error: productsError.message || "Не удалось связать товары",
          })
          continue
        }

        // Если есть материалы, создаем базовый рецепт (1 единица первого материала)
        if (materials && materials.length > 0) {
          const { error: materialsError } = await supabase.from("recipe_materials").insert({
            recipe_id: recipe.id,
            material_id: materials[0].id,
            quantity_needed: 1,
          })

          if (materialsError) {
            console.warn(`[v0] Не удалось добавить материал для рецепта ${recipe.id}:`, materialsError)
          }
        }

        createdRecipes.push({
          groupKey,
          recipeId: recipe.id,
          productCount: groupProducts.length,
        })
      } catch (error) {
        errors.push({
          groupKey,
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        })
      }
    }

    return NextResponse.json({
      success: true,
      created: createdRecipes.length,
      errors: errors.length,
      recipes: createdRecipes,
      errorsList: errors,
      totalGroups: groups.size,
    })
  } catch (error) {
    console.error("[v0] Ошибка автоматического создания рецептов:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}

