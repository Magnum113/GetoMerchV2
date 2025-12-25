-- Add currency column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RUB';

-- Create index for currency column
CREATE INDEX IF NOT EXISTS idx_products_currency ON products(currency);
