-- Добавление колонки warehouse_type в таблицу orders для маркировки FBS/FBO заказов
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_type TEXT;

-- Создание индекса для улучшения производительности при фильтрации по типу склада
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_type ON orders(warehouse_type);

-- Комментарий к колонке для документации
COMMENT ON COLUMN orders.warehouse_type IS 'Тип склада: FBS (Fulfillment by Seller) или FBO (Fulfillment by Ozon)';
