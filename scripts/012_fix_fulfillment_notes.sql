-- Исправляем старые fulfillment_notes которые содержат FBO для FBS заказов

DO $$
DECLARE
  updated_count INT;
BEGIN
  -- Обновляем fulfillment_notes для позиций с типом READY_STOCK у FBS заказов
  UPDATE order_items oi
  SET fulfillment_notes = 'Товар зарезервирован на складе HOME'
  FROM orders o
  WHERE oi.order_id = o.id
    AND o.warehouse_type = 'FBS'
    AND oi.fulfillment_type = 'READY_STOCK'
    AND oi.fulfillment_notes LIKE '%FBO%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Обновлено READY_STOCK позиций: %', updated_count;

  -- Обновляем fulfillment_notes для позиций с типом PRODUCE_ON_DEMAND у FBS заказов
  UPDATE order_items oi
  SET fulfillment_notes = 'Требуется производство товара'
  FROM orders o
  WHERE oi.order_id = o.id
    AND o.warehouse_type = 'FBS'
    AND oi.fulfillment_type = 'PRODUCE_ON_DEMAND'
    AND oi.fulfillment_notes LIKE '%FBO%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Обновлено PRODUCE_ON_DEMAND позиций: %', updated_count;

  -- Обновляем fulfillment_notes для позиций с типом FBO (правильные FBO заказы)
  UPDATE order_items oi
  SET fulfillment_notes = 'Заказ исполняется через склад Ozon (FBO)'
  FROM orders o
  WHERE oi.order_id = o.id
    AND o.warehouse_type = 'FBO'
    AND oi.fulfillment_type = 'FBO';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Обновлено FBO позиций: %', updated_count;
END $$;
