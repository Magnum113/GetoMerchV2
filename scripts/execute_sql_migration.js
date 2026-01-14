#!/usr/bin/env node

/**
 * Execute SQL migration directly via Supabase REST API
 * This script attempts to execute SQL using Supabase Management API
 */

const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

const migrationSQL = fs.readFileSync(
  path.join(__dirname, "025_add_delete_production_queue_function.sql"),
  "utf8"
);

async function executeMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL не настроен");
    process.exit(1);
  }

  console.log("🚀 Выполнение SQL миграции...");
  console.log("📋 Функция: delete_production_queue_item\n");

  // Try using service_role key if available
  if (supabaseServiceKey) {
    console.log("🔑 Используется service_role ключ для выполнения SQL...");
    
    try {
      // Supabase Management API endpoint for executing SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: migrationSQL })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ SQL успешно выполнен!");
        console.log("📊 Результат:", result);
        return;
      } else {
        console.log("⚠️  Прямое выполнение через REST API недоступно");
      }
    } catch (error) {
      console.log("⚠️  Ошибка выполнения через REST API:", error.message);
    }
  }

  // Fallback: Use Supabase JS client with anon key
  // Note: This won't work for DDL statements, but we can try
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("📝 Попытка выполнения через Supabase JS клиент...");
  
  // Check if function already exists
  try {
    const { data, error } = await supabase.rpc('delete_production_queue_item', {
      queue_item_id: '00000000-0000-0000-0000-000000000000'
    });

    if (!error || !error.message?.includes('does not exist')) {
      console.log("✅ Функция уже существует в базе данных!");
      return;
    }
  } catch (error) {
    // Function doesn't exist, which is expected
  }

  // Since we can't execute DDL via Supabase JS client with anon key,
  // we need to provide instructions
  console.log("\n" + "=".repeat(60));
  console.log("📋 ИНСТРУКЦИИ ДЛЯ ВЫПОЛНЕНИЯ SQL МИГРАЦИИ");
  console.log("=".repeat(60));
  console.log("\n1. Откройте Supabase Dashboard:");
  console.log(`   ${supabaseUrl.replace('/rest/v1', '')}`);
  console.log("\n2. Перейдите в SQL Editor (левое меню)");
  console.log("\n3. Скопируйте и выполните следующий SQL:\n");
  console.log("-".repeat(60));
  console.log(migrationSQL);
  console.log("-".repeat(60));
  console.log("\n4. После выполнения функция будет доступна");
  console.log("\n" + "=".repeat(60));
  
  // Also save SQL to a file for easy copy-paste
  const outputFile = path.join(__dirname, "025_migration_to_execute.sql");
  fs.writeFileSync(outputFile, migrationSQL);
  console.log(`\n💾 SQL также сохранен в файл: ${outputFile}`);
}

executeMigration().catch(console.error);
