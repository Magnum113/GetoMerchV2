import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

/**
 * Migration endpoint to apply the delete_production_queue_item function
 * Executes SQL directly via Supabase Management API
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, error: "NEXT_PUBLIC_SUPABASE_URL не настроен" },
        { status: 500 }
      )
    }

    // Read the SQL migration file
    const migrationFilePath = path.join(process.cwd(), "scripts", "025_add_delete_production_queue_function.sql")
    
    if (!fs.existsSync(migrationFilePath)) {
      return NextResponse.json(
        { success: false, error: "Файл миграции не найден" },
        { status: 404 }
      )
    }

    const migrationSQL = fs.readFileSync(migrationFilePath, "utf8")

    // Try to execute SQL using Supabase Management API
    if (supabaseServiceKey) {
      try {
        // Use Supabase Management API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: migrationSQL })
        })

        if (response.ok) {
          const result = await response.json()
          return NextResponse.json({
            success: true,
            message: "SQL миграция успешно выполнена",
            result
          })
        } else {
          const errorText = await response.text()
          console.error("Ошибка выполнения SQL:", errorText)
        }
      } catch (apiError) {
        console.error("Ошибка API:", apiError)
      }
    }

    // Alternative: Try using PostgREST to execute SQL via a custom function
    // Or use direct PostgreSQL connection if available
    
    // For now, return SQL to be executed manually
    return NextResponse.json({
      success: false,
      message: "Не удалось выполнить SQL автоматически. Используйте Supabase Dashboard или CLI",
      sql: migrationSQL,
      instructions: [
        "1. Откройте Supabase Dashboard",
        "2. Перейдите в SQL Editor",
        "3. Скопируйте SQL из поля 'sql'",
        "4. Выполните SQL запрос"
      ],
      note: "Для автоматического выполнения добавьте SUPABASE_SERVICE_ROLE_KEY в .env"
    })

  } catch (error) {
    console.error("[Migration] Ошибка:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Неизвестная ошибка" 
      },
      { status: 500 }
    )
  }
}
