-- Добавление unique constraint и необходимых колонок для order_items

-- Шаг 1: Удаляем дубликаты order_items (оставляем первую запись для каждой пары order_id, product_id)
DELETE FROM order_items a
USING order_items b
WHERE a.id > b.id 
  AND a.order_id = b.order_id 
  AND a.product_id = b.product_id;

-- Шаг 2: Добавляем unique constraint (если его еще нет)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_items_order_product_unique'
  ) THEN
    ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_product_unique UNIQUE (order_id, product_id);
  END IF;
END $$;

-- Шаг 3: Создаем индекс для производительности (если его еще нет)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product 
ON order_items(order_id, product_id);

-- Шаг 4: Добавляем колонку reservation_applied (если ее еще нет)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'reservation_applied'
  ) THEN
    ALTER TABLE order_items 
    ADD COLUMN reservation_applied BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Показываем результаты
SELECT 
  'Миграция завершена' as status,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'order_items_order_product_unique') as has_constraint,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'reservation_applied') as has_reservation_column;
