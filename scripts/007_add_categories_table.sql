-- Создание таблицы для хранения категорий Ozon
CREATE TABLE IF NOT EXISTS ozon_categories (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT UNIQUE NOT NULL,
  category_name TEXT NOT NULL,
  parent_id BIGINT,
  disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Индекс для быстрого поиска по category_id
CREATE INDEX IF NOT EXISTS idx_ozon_categories_category_id ON ozon_categories(category_id);

-- Индекс для поиска по родительским категориям
CREATE INDEX IF NOT EXISTS idx_ozon_categories_parent_id ON ozon_categories(parent_id);

-- RLS политики
ALTER TABLE ozon_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all users" ON ozon_categories
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for all users" ON ozon_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for all users" ON ozon_categories
  FOR UPDATE USING (true);
