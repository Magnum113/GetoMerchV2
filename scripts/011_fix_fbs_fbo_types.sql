-- Исправление типов склада для заказов
-- Все заказы загруженные через /v3/posting/fbs/list являются FBS, а не FBO

BEGIN;

-- Обновляем все заказы на FBS (так как текущий API endpoint загружает только FBS)
UPDATE orders
SET 
  warehouse_type = 'FBS',
  fulfillment_type = 'FBS'
WHERE warehouse_type = 'FBO';

-- Обновляем order_items чтобы изменить тип исполнения с FBO на READY_STOCK
-- использую 'ready' вместо 'reserved' так как это соответствует constraint
UPDATE order_items
SET 
  fulfillment_type = 'READY_STOCK',
  fulfillment_status = 'ready',
  fulfillment_decided_at = NOW()
WHERE fulfillment_type = 'FBO';

-- Логируем результаты
DO $$
DECLARE
  orders_updated INT;
  items_updated INT;
BEGIN
  SELECT COUNT(*) INTO orders_updated
  FROM orders
  WHERE warehouse_type = 'FBS';
  
  SELECT COUNT(*) INTO items_updated
  FROM order_items
  WHERE fulfillment_type = 'READY_STOCK';
  
  RAISE NOTICE 'Миграция завершена:';
  RAISE NOTICE '  - Всего заказов FBS: %', orders_updated;
  RAISE NOTICE '  - Позиций заказов с типом READY_STOCK: %', items_updated;
END $$;

COMMIT;
