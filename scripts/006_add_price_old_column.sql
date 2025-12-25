-- Добавляем колонку для старой цены (цена до скидки)
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_old DECIMAL(10, 2);

-- Добавляем комментарии для ясности
COMMENT ON COLUMN products.price IS 'Текущая цена товара (после скидки) из Ozon API field: price или min_price';
COMMENT ON COLUMN products.price_old IS 'Старая цена товара (до скидки) из Ozon API field: old_price';
COMMENT ON COLUMN products.currency IS 'Валюта цены (RUB, USD и т.д.) из Ozon API field: currency_code';
