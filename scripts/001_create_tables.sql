-- Create products table for Ozon catalog items
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ozon_product_id TEXT UNIQUE NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  price DECIMAL(10, 2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory table for stock tracking
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_location TEXT,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_location)
);

-- Create materials table for production components
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL, -- e.g., 'kg', 'pcs', 'meters'
  quantity_in_stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(10, 3) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10, 2),
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create recipes table for product production
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  production_time_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

-- Create recipe_materials table for materials needed in recipes
CREATE TABLE IF NOT EXISTS recipe_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  quantity_needed DECIMAL(10, 3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, material_id)
);

-- Create orders table for Ozon orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ozon_order_id TEXT UNIQUE NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL, -- 'awaiting_packaging', 'awaiting_deliver', 'delivered', 'cancelled'
  customer_name TEXT,
  total_amount DECIMAL(10, 2),
  order_date TIMESTAMPTZ NOT NULL,
  delivery_date TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create order_items table for products in orders
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create production_queue table for items to be produced
CREATE TABLE IF NOT EXISTS production_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  priority TEXT DEFAULT 'normal', -- 'high', 'normal', 'low'
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  order_id UUID REFERENCES orders(id),
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create replenishment_requests table for low stock alerts
CREATE TABLE IF NOT EXISTS replenishment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  quantity_needed DECIMAL(10, 3) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'ordered', 'received', 'cancelled'
  priority TEXT DEFAULT 'normal',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sync_log table for Ozon API sync tracking
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'products', 'orders', 'inventory'
  status TEXT NOT NULL, -- 'success', 'error', 'in_progress'
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_ozon_id ON products(ozon_product_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_ozon_id ON orders(ozon_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_production_queue_status ON production_queue(status);
CREATE INDEX IF NOT EXISTS idx_production_queue_product_id ON production_queue(product_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_status ON replenishment_requests(status);

-- Enable Row Level Security on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE replenishment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a business app)
-- In production, you'd want to add user-based policies

-- Products policies
CREATE POLICY "Allow public read access on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on products" ON products FOR DELETE USING (true);

-- Inventory policies
CREATE POLICY "Allow public read access on inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on inventory" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on inventory" ON inventory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on inventory" ON inventory FOR DELETE USING (true);

-- Materials policies
CREATE POLICY "Allow public read access on materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on materials" ON materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on materials" ON materials FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on materials" ON materials FOR DELETE USING (true);

-- Recipes policies
CREATE POLICY "Allow public read access on recipes" ON recipes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on recipes" ON recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on recipes" ON recipes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on recipes" ON recipes FOR DELETE USING (true);

-- Recipe materials policies
CREATE POLICY "Allow public read access on recipe_materials" ON recipe_materials FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on recipe_materials" ON recipe_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on recipe_materials" ON recipe_materials FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on recipe_materials" ON recipe_materials FOR DELETE USING (true);

-- Orders policies
CREATE POLICY "Allow public read access on orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on orders" ON orders FOR DELETE USING (true);

-- Order items policies
CREATE POLICY "Allow public read access on order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on order_items" ON order_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on order_items" ON order_items FOR DELETE USING (true);

-- Production queue policies
CREATE POLICY "Allow public read access on production_queue" ON production_queue FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on production_queue" ON production_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on production_queue" ON production_queue FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on production_queue" ON production_queue FOR DELETE USING (true);

-- Replenishment requests policies
CREATE POLICY "Allow public read access on replenishment_requests" ON replenishment_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on replenishment_requests" ON replenishment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on replenishment_requests" ON replenishment_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on replenishment_requests" ON replenishment_requests FOR DELETE USING (true);

-- Sync log policies
CREATE POLICY "Allow public read access on sync_log" ON sync_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on sync_log" ON sync_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on sync_log" ON sync_log FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on sync_log" ON sync_log FOR DELETE USING (true);
