-- Migration to add order_flow_status column
-- This creates a canonical status field that consolidates all order status information

BEGIN;

-- Create the order_flow_status enum type
CREATE TYPE order_flow_status_enum AS ENUM (
  'NEW',
  'NEED_PRODUCTION', 
  'NEED_MATERIALS',
  'IN_PRODUCTION',
  'READY_TO_SHIP',
  'SHIPPED',
  'DONE',
  'CANCELLED'
);

-- Add the order_flow_status column to orders table
ALTER TABLE orders ADD COLUMN order_flow_status order_flow_status_enum;

-- Set default values based on existing operational_status
-- This mapping ensures backward compatibility
UPDATE orders SET order_flow_status = 
  CASE operational_status
    WHEN 'READY_TO_SHIP' THEN 'READY_TO_SHIP'
    WHEN 'WAITING_FOR_PRODUCTION' THEN 'NEED_PRODUCTION'
    WHEN 'IN_PRODUCTION' THEN 'IN_PRODUCTION'
    WHEN 'WAITING_FOR_MATERIALS' THEN 'NEED_MATERIALS'
    WHEN 'SHIPPED' THEN 'SHIPPED'
    WHEN 'DONE' THEN 'DONE'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'BLOCKED' THEN 'CANCELLED'
    ELSE 'NEW'
  END;

-- Add trigger to automatically update order_flow_status when operational_status changes
CREATE OR REPLACE FUNCTION update_order_flow_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_flow_status = 
    CASE NEW.operational_status
      WHEN 'READY_TO_SHIP' THEN 'READY_TO_SHIP'
      WHEN 'WAITING_FOR_PRODUCTION' THEN 'NEED_PRODUCTION'
      WHEN 'IN_PRODUCTION' THEN 'IN_PRODUCTION'
      WHEN 'WAITING_FOR_MATERIALS' THEN 'NEED_MATERIALS'
      WHEN 'SHIPPED' THEN 'SHIPPED'
      WHEN 'DONE' THEN 'DONE'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      WHEN 'BLOCKED' THEN 'CANCELLED'
      ELSE 'NEW'
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_flow_status
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_order_flow_status();

-- Create function to automatically mark old orders as DONE
CREATE OR REPLACE FUNCTION mark_old_orders_as_done()
RETURNS TRIGGER AS $$
DECLARE
  order_age INTEGER;
BEGIN
  -- Calculate order age in days
  SELECT EXTRACT(DAY FROM AGE(CURRENT_TIMESTAMP, NEW.order_date)) INTO order_age;
  
  -- If order is older than 30 days and not already DONE/CANCELLED, mark as DONE
  IF order_age > 30 AND NEW.order_flow_status NOT IN ('DONE', 'CANCELLED') THEN
    NEW.order_flow_status = 'DONE';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_old_orders_as_done
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION mark_old_orders_as_done();

COMMIT;

