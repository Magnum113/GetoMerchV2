-- ФАЗА 1: Создание таблицы складов с типами
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('HOME', 'PRODUCTION_CENTER')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ФАЗА 2: Добавление warehouse_id в таблицу material_lots (если не существует)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'material_lots' AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE material_lots ADD COLUMN warehouse_id TEXT DEFAULT 'HOME';
    
    -- Создание индекса для улучшения производительности
    CREATE INDEX IF NOT EXISTS idx_material_lots_warehouse_id ON material_lots(warehouse_id);
    
    -- Обновление существующих записей на HOME (если они пустые)
    UPDATE material_lots SET warehouse_id = 'HOME' WHERE warehouse_id IS NULL;
    
    -- Добавление ограничения NOT NULL
    ALTER TABLE material_lots ALTER COLUMN warehouse_id SET NOT NULL;
    
    -- Добавление ограничения CHECK для допустимых значений
    ALTER TABLE material_lots ADD CONSTRAINT warehouse_id_valid CHECK (warehouse_id IN ('HOME', 'PRODUCTION_CENTER'));
  END IF;
END $$;

-- ФАЗА 3: Добавление warehouse_id в таблицу inventory (если не существует)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE inventory ADD COLUMN warehouse_id TEXT DEFAULT 'HOME';
    
    -- Создание индекса для улучшения производительности
    CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON inventory(warehouse_id);
    
    -- Обновление существующих записей на HOME (если они пустые)
    UPDATE inventory SET warehouse_id = 'HOME' WHERE warehouse_id IS NULL;
    
    -- Добавление ограничения NOT NULL
    ALTER TABLE inventory ALTER COLUMN warehouse_id SET NOT NULL;
    
    -- Добавление ограничения CHECK для допустимых значений
    ALTER TABLE inventory ADD CONSTRAINT warehouse_id_valid CHECK (warehouse_id IN ('HOME', 'PRODUCTION_CENTER'));
  END IF;
END $$;

-- ФАЗА 4: Создание стандартных складов (если не существуют)
INSERT INTO warehouses (id, name, type, description) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Домашний склад', 'HOME', 'Основной склад для хранения заготовок и готовой продукции'),
  ('00000000-0000-0000-0000-000000000002', 'Склад вышивки/печати', 'PRODUCTION_CENTER', 'Производственный склад только для заготовок')
ON CONFLICT (id) DO NOTHING;

-- ФАЗА 5: Создание представления для агрегированной доступности материалов по складам
CREATE OR REPLACE VIEW material_availability_by_warehouse AS
SELECT 
  ml.material_definition_id,
  md.name AS material_name,
  md.unit,
  ml.warehouse_id,
  w.name AS warehouse_name,
  w.type AS warehouse_type,
  SUM(ml.quantity) AS total_quantity,
  SUM(ml.quantity) - COALESCE(
    (SELECT SUM(mm.quantity_change)
     FROM material_movements mm
     WHERE mm.material_lot_id = ml.id AND mm.quantity_change < 0),
    0
  ) AS available_quantity,
  COUNT(DISTINCT ml.id) AS lot_count,
  AVG(ml.cost_per_unit) AS avg_cost_per_unit
FROM material_lots ml
JOIN material_definitions md ON ml.material_definition_id = md.id
LEFT JOIN warehouses w ON ml.warehouse_id = w.id
GROUP BY ml.material_definition_id, md.name, md.unit, ml.warehouse_id, w.name, w.type;

-- ФАЗА 6: Обновление существующего представления material_availability для совместимости
CREATE OR REPLACE VIEW material_availability AS
SELECT 
  material_definition_id,
  material_name,
  unit,
  SUM(total_quantity) AS total_quantity,
  SUM(available_quantity) AS available_quantity,
  SUM(lot_count) AS lot_count,
  AVG(avg_cost_per_unit) AS avg_cost_per_unit,
  jsonb_agg(
    jsonb_build_object(
      'warehouse_id', warehouse_id,
      'warehouse_name', warehouse_name,
      'warehouse_type', warehouse_type,
      'quantity', total_quantity,
      'available_quantity', available_quantity
    )
  ) AS warehouse_details
FROM material_availability_by_warehouse
GROUP BY material_definition_id, material_name, unit;

-- ФАЗА 7: Создание функции для получения доступного количества материала по складу
CREATE OR REPLACE FUNCTION get_material_definition_available_quantity_by_warehouse(
  def_id_param UUID,
  warehouse_id_param TEXT DEFAULT NULL
) RETURNS DECIMAL(10, 3) AS $$
DECLARE
  result DECIMAL(10, 3) DEFAULT 0;
BEGIN
  IF warehouse_id_param IS NOT NULL THEN
    -- Получаем доступное количество для конкретного склада
    SELECT COALESCE(SUM(ml.quantity) - COALESCE(
      (SELECT SUM(mm.quantity_change)
       FROM material_movements mm
       WHERE mm.material_lot_id = ml.id AND mm.quantity_change < 0),
      0
    ), 0) INTO result
    FROM material_lots ml
    WHERE ml.material_definition_id = def_id_param
    AND ml.warehouse_id = warehouse_id_param;
  ELSE
    -- Получаем общее доступное количество по всем складам (для обратной совместимости)
    SELECT COALESCE(SUM(ml.quantity) - COALESCE(
      (SELECT SUM(mm.quantity_change)
       FROM material_movements mm
       WHERE mm.material_lot_id = ml.id AND mm.quantity_change < 0),
      0
    ), 0) INTO result
    FROM material_lots ml
    WHERE ml.material_definition_id = def_id_param;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ФАЗА 8: Создание функции для получения доступного количества конкретной партии
CREATE OR REPLACE FUNCTION get_material_lot_available_quantity(
  lot_id_param UUID
) RETURNS DECIMAL(10, 3) AS $$
DECLARE
  result DECIMAL(10, 3) DEFAULT 0;
  lot_quantity DECIMAL(10, 3);
  reserved_quantity DECIMAL(10, 3);
BEGIN
  -- Получаем количество партии
  SELECT quantity INTO lot_quantity
  FROM material_lots
  WHERE id = lot_id_param;

  -- Получаем зарезервированное количество (отрицательные движения)
  SELECT COALESCE(SUM(quantity_change), 0) INTO reserved_quantity
  FROM material_movements
  WHERE material_lot_id = lot_id_param AND quantity_change < 0;

  -- Доступное количество = общее количество - зарезервированное
  result := lot_quantity - reserved_quantity;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ФАЗА 9: Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_material_lots_definition_warehouse ON material_lots(material_definition_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_lot ON material_movements(material_lot_id);

-- ФАЗА 10: RLS политики для новых таблиц
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on warehouses" ON warehouses FOR SELECT USING (true);
CREATE POLICY "Allow public insert on warehouses" ON warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on warehouses" ON warehouses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on warehouses" ON warehouses FOR DELETE USING (true);

-- ФАЗА 11: Комментарии для документации
COMMENT ON TABLE warehouses IS 'Склады с типами для управления инвентарем и производством';
COMMENT ON COLUMN warehouses.type IS 'Тип склада: HOME (домашний) или PRODUCTION_CENTER (производственный)';
COMMENT ON COLUMN material_lots.warehouse_id IS 'Склад, на котором хранится партия материала';
COMMENT ON COLUMN inventory.warehouse_id IS 'Склад, на котором хранится готовая продукция';
