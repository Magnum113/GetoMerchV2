-- Добавляем поля для управления fulfillment flow в таблицу order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'PENDING' CHECK (fulfillment_type IN ('PENDING', 'READY_STOCK', 'PRODUCE_ON_DEMAND', 'FBO')),
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'planned' CHECK (fulfillment_status IN ('planned', 'in_production', 'ready', 'shipped', 'cancelled')),
ADD COLUMN IF NOT EXISTS fulfillment_source TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_decided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS production_queue_id UUID REFERENCES production_queue(id);

-- Добавляем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillment_type ON order_items(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillment_status ON order_items(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_production_queue_id ON order_items(production_queue_id);

-- Добавляем поле для указания типа склада FBS/FBO в таблицу orders (если еще нет)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'FBS' CHECK (fulfillment_type IN ('FBS', 'FBO'));

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);

-- Добавляем связь производства с конкретной позицией заказа
ALTER TABLE production_queue
ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id);

CREATE INDEX IF NOT EXISTS idx_production_queue_order_item_id ON production_queue(order_item_id);

-- Создаем таблицу для логирования всех fulfillment событий
CREATE TABLE IF NOT EXISTS fulfillment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'scenario_decided', 'production_created', 'materials_reserved', 'production_started', 'production_completed', 'ready_for_shipping'
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_events_order_item_id ON fulfillment_events(order_item_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_events_type ON fulfillment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fulfillment_events_created_at ON fulfillment_events(created_at DESC);

-- Добавляем RLS для новой таблицы
ALTER TABLE fulfillment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on fulfillment_events" ON fulfillment_events FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on fulfillment_events" ON fulfillment_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on fulfillment_events" ON fulfillment_events FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on fulfillment_events" ON fulfillment_events FOR DELETE USING (true);

-- Добавляем комментарии для документации
COMMENT ON COLUMN order_items.fulfillment_type IS 'Сценарий исполнения: PENDING (не определен), READY_STOCK (со склада), PRODUCE_ON_DEMAND (требуется производство), FBO (через Ozon)';
COMMENT ON COLUMN order_items.fulfillment_status IS 'Статус исполнения: planned, in_production, ready, shipped, cancelled';
COMMENT ON COLUMN order_items.fulfillment_source IS 'Источник товара: HOME, OZON_FBS, OZON_FBO, PRODUCTION';
COMMENT ON TABLE fulfillment_events IS 'Лог всех событий в процессе исполнения заказов для полной прозрачности';
