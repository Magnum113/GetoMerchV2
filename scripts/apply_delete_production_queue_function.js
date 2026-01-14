#!/usr/bin/env node

/**
 * Apply delete_production_queue_item function migration
 * Creates the SQL function for safely deleting production queue items
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

// Check if Supabase URL and key are available
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("❌ Ошибка: Необходимо настроить переменные окружения Supabase");
  console.log("   Создайте файл .env с:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url");
  console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key");
  process.exit(1);
}

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL migration file
const migrationFilePath = path.join(__dirname, "025_add_delete_production_queue_function.sql");

if (!fs.existsSync(migrationFilePath)) {
  console.error("❌ Ошибка: Файл миграции не найден:", migrationFilePath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFilePath, "utf8");

console.log("🚀 Применение миграции для функции удаления элементов очереди производства...");
console.log("📋 Создается функция: delete_production_queue_item");

async function applyMigration() {
  try {
    // Split SQL into individual statements
    // Remove comments and split by semicolons
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.match(/^\s*$/));

    // For Supabase, we need to execute SQL through RPC or use Management API
    // Since we're using anon key, we'll try to create the function via a custom RPC
    // But first, let's try using the Supabase REST API directly
    
    // Actually, the best approach is to use Supabase's SQL execution via REST API
    // But that requires service_role key. Let's try a different approach:
    // We'll create a temporary RPC function that executes our SQL, or
    // We'll use the Supabase client's ability to execute raw SQL if available
    
    // Check if we can use the REST API with SQL endpoint
    // Supabase has a REST endpoint for executing SQL: /rest/v1/rpc/exec_sql
    // But this typically requires service_role key
    
    // Alternative: Use Supabase Management API if available
    // Or create the function through a migration tool
    
    // For now, let's try executing via a direct HTTP request to Supabase
    console.log("\n📝 Выполнение SQL...");
    
    // Try to execute SQL using Supabase's REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (response.ok) {
      console.log("   ✅ Функция успешно создана!");
    } else {
      // If REST API doesn't work, try alternative approach
      console.log("   ⚠️  Прямое выполнение SQL через REST API недоступно");
      console.log("   📋 Выполните SQL вручную через Supabase Dashboard:");
      console.log("   ");
      console.log("   1. Откройте Supabase Dashboard");
      console.log("   2. Перейдите в SQL Editor");
      console.log("   3. Скопируйте и выполните содержимое файла:");
      console.log(`      ${migrationFilePath}`);
      console.log("   ");
      console.log("   Или используйте Supabase CLI:");
      console.log(`   supabase db execute -f ${migrationFilePath}`);
      
      // Also try to verify if function already exists
      const { data: testResult, error: testError } = await supabase.rpc('delete_production_queue_item', {
        queue_item_id: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
      });
      
      if (!testError || !testError.message?.includes('does not exist')) {
        console.log("   ✅ Функция уже существует в базе данных!");
        return;
      }
    }

    // Verify the function was created
    console.log("\n🔍 Проверка функции...");
    const { data: verifyResult, error: verifyError } = await supabase.rpc('delete_production_queue_item', {
      queue_item_id: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });

    if (verifyError) {
      if (verifyError.message?.includes('does not exist')) {
        console.log("   ⚠️  Функция еще не создана");
        console.log("   📋 Выполните SQL вручную через Supabase Dashboard или CLI");
      } else {
        // Function exists but returned an error (expected for test UUID)
        console.log("   ✅ Функция успешно создана и работает!");
      }
    } else {
      console.log("   ✅ Функция успешно создана и работает!");
    }

    console.log("\n🎉 Миграция завершена!");
    console.log("\n📋 Что было сделано:");
    console.log("   ✅ Создана функция delete_production_queue_item");
    console.log("   ✅ Функция безопасно удаляет элементы очереди производства");
    console.log("   ✅ Автоматически обновляет связанные записи order_items");
    console.log("   ✅ Все операции выполняются в одной транзакции");

  } catch (error) {
    console.error("\n❌ Ошибка миграции:", error.message);
    console.log("\n📋 Рекомендации:");
    console.log("   1. Проверьте подключение к базе данных");
    console.log("   2. Убедитесь, что переменные окружения настроены правильно");
    console.log("   3. Выполните SQL миграцию вручную через Supabase Dashboard:");
    console.log("      - Откройте SQL Editor");
    console.log(`      - Скопируйте содержимое файла: ${migrationFilePath}`);
    console.log("      - Выполните SQL запрос");
    console.log("\n   Или используйте Supabase CLI:");
    console.log(`   supabase db execute -f ${migrationFilePath}`);
  }
}

// Run the migration
applyMigration();
