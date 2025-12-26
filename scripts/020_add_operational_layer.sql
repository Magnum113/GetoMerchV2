-- ФАЗА 1: РАСШИРЕНИЕ ТАБЛИЦЫ PRODUCTS
-- Добавить типы товаров (готовая продукция vs заготовки/материалы)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'FINISHED_GOOD'; -- FINISHED_GOOD or BLANK_MATERIAL

-- ФАЗА 2: ДОБАВИТЬ ОПЕРАЦИОННЫЕ СТАТУСЫ К ЗАКАЗАМ
ALTER TABLE orders ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'PENDING'; -- PENDING, READY_TO_SHIP, WAITING_FOR_PRODUCTION, IN_PRODUCTION, WAITING_FOR_MATERIALS, BLOCKED, SHIPPED, DONE
ALTER TABLE orders ADD COLUMN IF NOT EXISTS operation_notes TEXT; -- Заметки оператора
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_ship_date TIMESTAMPTZ; -- Когда планируем отправить

-- ФАЗА 3: СОЗДАТЬ ТАБЛИЦУ ОПЕРАЦИОННЫХ ЗАДАЧ (агрегированные производственные задачи)
-- Это НЕ заказы, а производственные потребности
CREATE TABLE IF NOT EXISTS operation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'PRODUCE', 'REPLENISH_BLANKS', 'REPLENISH_MATERIALS'
  quantity_needed INTEGER NOT NULL,
  quantity_completed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority TEXT DEFAULT 'normal', -- 'high', 'normal', 'low'
  related_orders TEXT[], -- массив order_id для агрегированных заказов
  materials_reserved BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ФАЗА 4: СОЗДАТЬ ТАБЛИЦУ ДНЕВНОГО ПЛАНА
CREATE TABLE IF NOT EXISTS daily_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_date DATE NOT NULL,
  total_orders_to_ship INTEGER DEFAULT 0, -- Сколько заказов нужно отправить
  orders_ready_to_ship INTEGER DEFAULT 0, -- Сколько можно отправить сразу
  production_tasks_total INTEGER DEFAULT 0, -- Всего производственных задач
  materials_deficit TEXT DEFAULT '{}', -- JSON с дефицитом материалов
  replenishment_requests_needed INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ФАЗА 5: ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_orders_operational_status ON orders(operational_status);
CREATE INDEX IF NOT EXISTS idx_operation_tasks_status ON operation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_operation_tasks_product_id ON operation_tasks(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_operations_date ON daily_operations(operation_date);

-- ФАЗА 6: ПОЛИТИКИ RLS
ALTER TABLE operation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on operation_tasks" ON operation_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on operation_tasks" ON operation_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on operation_tasks" ON operation_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on operation_tasks" ON operation_tasks FOR DELETE USING (true);

CREATE POLICY "Allow public read on daily_operations" ON daily_operations FOR SELECT USING (true);
CREATE POLICY "Allow public insert on daily_operations" ON daily_operations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on daily_operations" ON daily_operations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on daily_operations" ON daily_operations FOR DELETE USING (true);
