-- Скрипт очистки тестовых данных
-- Удаляет заказы, производство и логи, сохраняя товары и материалы

BEGIN;

DELETE FROM order_items;
DELETE FROM recipe_materials;
DELETE FROM production_queue;
DELETE FROM orders;
DELETE FROM sync_log;
DELETE FROM replenishment_requests;

COMMIT;

SELECT 
  'Очистка завершена' as status,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM production_queue) as production_count,
  (SELECT COUNT(*) FROM sync_log) as sync_log_count,
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM materials) as materials_count,
  (SELECT COUNT(*) FROM inventory) as inventory_count;
