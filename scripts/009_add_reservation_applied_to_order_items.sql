-- Добавляем колонку reservation_applied в таблицу order_items
-- Эта колонка отслеживает, был ли уже применен резерв инвентаря для данной позиции заказа

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS reservation_applied BOOLEAN DEFAULT false;

-- Создаем индекс для оптимизации запросов по этому полю
CREATE INDEX IF NOT EXISTS idx_order_items_reservation_applied 
ON order_items(reservation_applied);

-- Обновляем существующие записи чтобы пометить их как уже обработанные
-- (предполагаем что для старых заказов резерв уже был применен вручную или не нужен)
UPDATE order_items 
SET reservation_applied = false 
WHERE reservation_applied IS NULL;

COMMENT ON COLUMN order_items.reservation_applied IS 
'Флаг указывающий был ли применен резерв инвентаря для этой позиции заказа. Используется для предотвращения двойного резервирования при повторной синхронизации заказов.';
