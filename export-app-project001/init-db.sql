-- =======================================================================================
-- DATABASE ARCHITECTURE - POSTGRESQL SQL SCRIPT (SUPABASE COMPATIBLE)
-- Collaborative Export & Stuffing Operations Platform - Tapioca Hard Pellet
-- Features: 4-Level RBAC & Row Level Security (RLS)
-- =======================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
    'management', 
    'operations', -- Consolidates Prod/Warehouse/Shipping
    'sales', 
    'customer'
);

CREATE TYPE booking_status_enum AS ENUM (
    'planned', 
    'confirmed'
);

-- ---------------------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    sales_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Self-referencing for hierarchy if needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    sales_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL
);

CREATE TABLE product_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    starch_min_pct DECIMAL(5, 2) DEFAULT 68.00,
    moisture_max_pct DECIMAL(5, 2) DEFAULT 14.00,
    sand_max_pct DECIMAL(5, 2),
    fiber_max_pct DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE packaging_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_size VARCHAR(50) CHECK (container_size IN ('20''', '40''HQ')),
    packaging_type VARCHAR(100),
    unit_weight_kg DECIMAL(10, 2),
    bag_qty_per_container INTEGER,
    std_payload_mt DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    total_qty_mt DECIMAL(12, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_value DECIMAL(15, 2) GENERATED ALWAYS AS (total_qty_mt * unit_price) STORED,
    currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    di_number VARCHAR(100) UNIQUE NOT NULL,
    status SMALLINT NOT NULL CHECK (status >= 1 AND status <= 8),
    product_spec_id UUID REFERENCES product_specifications(id) ON DELETE RESTRICT,
    packaging_config_id UUID REFERENCES packaging_configurations(id) ON DELETE RESTRICT,
    container_count INTEGER NOT NULL,
    stuffing_date DATE,
    booking_status booking_status_enum DEFAULT 'planned',
    port_loading VARCHAR(255),
    port_discharge VARCHAR(255),
    etd_date DATE,
    eta_date DATE,
    has_issue BOOLEAN DEFAULT FALSE,
    issue_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipment_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    container_number VARCHAR(50),
    seal_number VARCHAR(50),
    actual_weight_mt DECIMAL(10, 2),
    photo_url TEXT,
    stuffed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (shipment_id, container_number)
);

CREATE TABLE shipment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    from_status SMALLINT CHECK (from_status >= 1 AND from_status <= 8),
    to_status SMALLINT NOT NULL CHECK (to_status >= 1 AND to_status <= 8),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES (SUPABASE AUTH.UID() COMPATIBLE)
-- ---------------------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Management: Full Access to everything
CREATE POLICY management_all ON users FOR ALL USING (get_user_role() = 'management');
CREATE POLICY management_all ON customers FOR ALL USING (get_user_role() = 'management');
CREATE POLICY management_all ON purchase_orders FOR ALL USING (get_user_role() = 'management');
CREATE POLICY management_all ON shipments FOR ALL USING (get_user_role() = 'management');
CREATE POLICY management_all ON shipment_containers FOR ALL USING (get_user_role() = 'management');

-- Master Data (Products, Configs): Read-only for all, write for management
CREATE POLICY public_read_products ON products FOR SELECT USING (true);
CREATE POLICY public_read_specs ON product_specifications FOR SELECT USING (true);
CREATE POLICY public_read_pkg ON packaging_configurations FOR SELECT USING (true);

-- 2. Operations (Prod/Warehouse/Shipping)
-- Task specific access. No pricing visibility (Cannot select PO price).
CREATE POLICY ops_read_customers ON customers FOR SELECT USING (get_user_role() = 'operations');
-- Restrict PO selection (omit pricing via view or app level, but RLS restricts entire row. 
-- In pure Postgres, column-level SELECT privileges are used. For RLS, they can read the row but UI hides price, OR we grant access to a specific view).
CREATE POLICY ops_read_po ON purchase_orders FOR SELECT USING (get_user_role() = 'operations');
CREATE POLICY ops_all_shipments ON shipments FOR ALL USING (get_user_role() = 'operations');
CREATE POLICY ops_all_containers ON shipment_containers FOR ALL USING (get_user_role() = 'operations');

-- 3. Sales
-- Access restricted to their assigned customers
CREATE POLICY sales_read_customers ON customers FOR SELECT USING (get_user_role() = 'sales' AND sales_owner_id = auth.uid());
CREATE POLICY sales_read_po ON purchase_orders FOR SELECT USING (
    get_user_role() = 'sales' AND customer_id IN (SELECT id FROM customers WHERE sales_owner_id = auth.uid())
);
CREATE POLICY sales_read_shipments ON shipments FOR SELECT USING (
    get_user_role() = 'sales' AND po_id IN (SELECT id FROM purchase_orders WHERE customer_id IN (SELECT id FROM customers WHERE sales_owner_id = auth.uid()))
);

-- 4. Customers
-- Read-only access to their specific shipments and documents
CREATE POLICY customer_read_own_po ON purchase_orders FOR SELECT USING (
    get_user_role() = 'customer' AND customer_id IN (SELECT id FROM customers WHERE id = auth.uid()) -- Assuming user.id maps to customer or via auth mapping
);
CREATE POLICY customer_read_own_shipments ON shipments FOR SELECT USING (
    get_user_role() = 'customer' AND po_id IN (SELECT id FROM purchase_orders WHERE customer_id = auth.uid())
);

-- ---------------------------------------------------------------------------------------
-- DEFAULT SEED DATA
-- ---------------------------------------------------------------------------------------
WITH new_product AS (
    INSERT INTO products (id, product_code, product_name)
    VALUES (gen_random_uuid(), 'THP-01', 'Tapioca Hard Pellet')
    RETURNING id
),
new_spec AS (
    INSERT INTO product_specifications (id, product_id, starch_min_pct, moisture_max_pct, sand_max_pct, fiber_max_pct)
    SELECT gen_random_uuid(), id, 68.00, 14.00, 3.00, 5.00 FROM new_product
    RETURNING id
)
SELECT * FROM new_spec;

INSERT INTO packaging_configurations (id, container_size, packaging_type, unit_weight_kg, bag_qty_per_container, std_payload_mt)
VALUES (gen_random_uuid(), '20''', 'Jumbo Bag', 950.00, 20, 19.00);
