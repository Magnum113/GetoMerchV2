#!/usr/bin/env node

/**
 * Apply migration via Supabase Management API
 * Uses project_ref to execute SQL directly
 */

const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

const PROJECT_REF = "qtldwhfddvxilsfuifob";
const migrationSQL = fs.readFileSync(
  path.join(__dirname, "025_add_delete_production_queue_function.sql"),
  "utf8"
);

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("🚀 Применение миграции через Supabase API...");
  console.log(`📋 Project Ref: ${PROJECT_REF}\n`);

  if (!supabaseUrl) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL не настроен");
    process.exit(1);
  }

  // Try using Supabase Management API
  // The Management API endpoint for executing SQL is:
  // POST https://api.supabase.com/v1/projects/{project_ref}/database/query
  
  if (supabaseServiceKey) {
    try {
      console.log("🔑 Используется service_role ключ...");
      
      const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          query: migrationSQL
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ SQL миграция успешно выполнена!");
        console.log("📊 Результат:", JSON.stringify(result, null, 2));
        return;
      } else {
        const errorText = await response.text();
        console.error("❌ Ошибка выполнения SQL:", errorText);
      }
    } catch (error) {
      console.error("❌ Ошибка API:", error.message);
    }
  }

  // Alternative: Use Supabase REST API directly
  try {
    console.log("📝 Попытка выполнения через Supabase REST API...");
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ SQL успешно выполнен через REST API!");
      return;
    } else {
      const errorText = await response.text();
      console.log("⚠️  REST API недоступен:", errorText);
    }
  } catch (error) {
    console.log("⚠️  Ошибка REST API:", error.message);
  }

  // If all automated methods fail, provide instructions
  console.log("\n" + "=".repeat(70));
  console.log("📋 АВТОМАТИЧЕСКОЕ ВЫПОЛНЕНИЕ НЕВОЗМОЖНО");
  console.log("=".repeat(70));
  console.log("\nВыполните SQL вручную через Supabase Dashboard:\n");
  console.log("1. Откройте: https://app.supabase.com/project/" + PROJECT_REF);
  console.log("2. Перейдите в SQL Editor");
  console.log("3. Скопируйте и выполните следующий SQL:\n");
  console.log("-".repeat(70));
  console.log(migrationSQL);
  console.log("-".repeat(70));
  console.log("\n💡 Для автоматического выполнения добавьте SUPABASE_SERVICE_ROLE_KEY в .env");
}

applyMigration().catch(console.error);
