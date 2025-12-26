-- Миграция 021: Установить operational_status для всех существующих заказов
-- на основе их fulfillment_type

-- Установить READY_TO_SHIP для заказов с READY_STOCK товарами
UPDATE orders o
SET operational_status = 'READY_TO_SHIP'
WHERE EXISTS (
  SELECT 1 FROM order_items oi
  WHERE oi.order_id = o.id
  AND oi.fulfillment_type = 'READY_STOCK'
  AND oi.fulfillment_status IN ('ready', 'planned')
)
AND o.operational_status = 'PENDING';

-- Установить WAITING_FOR_PRODUCTION для заказов в производстве
UPDATE orders o
SET operational_status = 'WAITING_FOR_PRODUCTION'
WHERE EXISTS (
  SELECT 1 FROM order_items oi
  WHERE oi.order_id = o.id
  AND oi.fulfillment_type = 'PRODUCE_ON_DEMAND'
  AND oi.fulfillment_status = 'planned'
)
AND o.operational_status = 'PENDING';

-- Установить IN_PRODUCTION для заказов где производство начато
UPDATE orders o
SET operational_status = 'IN_PRODUCTION'
WHERE EXISTS (
  SELECT 1 FROM order_items oi
  WHERE oi.order_id = o.id
  AND oi.fulfillment_type = 'PRODUCE_ON_DEMAND'
  AND oi.fulfillment_status = 'in_production'
)
AND o.operational_status IN ('PENDING', 'WAITING_FOR_PRODUCTION');

-- Вывести результаты
DO $$
DECLARE
  ready_to_ship_count INTEGER;
  waiting_for_production_count INTEGER;
  in_production_count INTEGER;
  pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ready_to_ship_count FROM orders WHERE operational_status = 'READY_TO_SHIP';
  SELECT COUNT(*) INTO waiting_for_production_count FROM orders WHERE operational_status = 'WAITING_FOR_PRODUCTION';
  SELECT COUNT(*) INTO in_production_count FROM orders WHERE operational_status = 'IN_PRODUCTION';
  SELECT COUNT(*) INTO pending_count FROM orders WHERE operational_status = 'PENDING';
  
  RAISE NOTICE 'Операционные статусы обновлены:';
  RAISE NOTICE '  - READY_TO_SHIP: %', ready_to_ship_count;
  RAISE NOTICE '  - WAITING_FOR_PRODUCTION: %', waiting_for_production_count;
  RAISE NOTICE '  - IN_PRODUCTION: %', in_production_count;
  RAISE NOTICE '  - PENDING: %', pending_count;
END $$;
