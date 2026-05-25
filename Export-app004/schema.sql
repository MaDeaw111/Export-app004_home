-- ==========================================
-- SHIPMENT TRACKING APPLICATION SCHEMA & SEED
-- ==========================================

-- Enable UUID Generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS public.shipments CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;

-- 1. USER PERMISSIONS / PROFILES TABLE
-- Directly mapped to Supabase auth.users for secure authentication & routing
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 2. CUSTOMERS TABLE
CREATE TABLE public.customers (
    customer_id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    country TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 3. PURCHASE ORDERS (POs) TABLE
CREATE TABLE public.purchase_orders (
    po_no TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE RESTRICT,
    po_date DATE NOT NULL,
    total_amount_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount_usd >= 0),
    payment_term TEXT NOT NULL,
    sales_person_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- 4. SHIPMENTS (Delivery Instructions - DIs) TABLE
CREATE TABLE public.shipments (
    di_no TEXT PRIMARY KEY,
    po_no TEXT NOT NULL REFERENCES public.purchase_orders(po_no) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN (
        'pending_production',
        'pending_packaging',
        'awaiting_loading',
        'loaded_into_container',
        'awaiting_bl_confirmation',
        'awaiting_all_docs',
        'etd',
        'eta'
    )) DEFAULT 'pending_production',
    product_id TEXT NOT NULL,
    quantity_tons NUMERIC(12, 3) NOT NULL CHECK (quantity_tons > 0),
    container_no TEXT,
    seal_no TEXT,
    forwarder_id TEXT,
    vessel_voyage TEXT,
    shipment_type TEXT CHECK (shipment_type IN ('container', 'bulk', 'domestic')) DEFAULT 'container',
    etd_date DATE,
    eta_date DATE,
    bl_draft_link TEXT,
    shipping_docs_link TEXT,
    booking_no TEXT,
    invoice_no TEXT,
    container_size TEXT,
    -- B/L Confirmation flow attributes
    bl_approval_status TEXT CHECK (bl_approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    bl_feedback TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- A. USER PERMISSIONS / PROFILES
CREATE POLICY "Allow users to view own profile" 
    ON public.user_permissions FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Allow admins full access to profiles" 
    ON public.user_permissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- B. CUSTOMERS
CREATE POLICY "Allow customers to view their own customer record" 
    ON public.customers FOR SELECT 
    USING (
        email = (SELECT email FROM public.user_permissions WHERE id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_permissions WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Allow admins full access to customers" 
    ON public.customers FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- C. PURCHASE ORDERS
CREATE POLICY "Allow users to view their related POs" 
    ON public.purchase_orders FOR SELECT 
    USING (
        customer_id = (
            SELECT customer_id FROM public.customers 
            WHERE email = (SELECT email FROM public.user_permissions WHERE id = auth.uid())
        ) OR
        EXISTS (SELECT 1 FROM public.user_permissions WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Allow admins full access to POs" 
    ON public.purchase_orders FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- D. SHIPMENTS
CREATE POLICY "Allow users to view their related Shipments" 
    ON public.shipments FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders PO
            JOIN public.customers C ON C.customer_id = PO.customer_id
            JOIN public.user_permissions UP ON UP.email = C.email
            WHERE UP.id = auth.uid() AND PO.po_no = shipments.po_no
        ) OR
        EXISTS (SELECT 1 FROM public.user_permissions WHERE id = auth.uid() AND role = 'admin')
    );

-- Customers can update shipments to approve or reject B/L drafts
CREATE POLICY "Allow customers to update B/L status on related shipments" 
    ON public.shipments FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders PO
            JOIN public.customers C ON C.customer_id = PO.customer_id
            JOIN public.user_permissions UP ON UP.email = C.email
            WHERE UP.id = auth.uid() AND PO.po_no = shipments.po_no
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.purchase_orders PO
            JOIN public.customers C ON C.customer_id = PO.customer_id
            JOIN public.user_permissions UP ON UP.email = C.email
            WHERE UP.id = auth.uid() AND PO.po_no = shipments.po_no
        )
    );

CREATE POLICY "Allow admins full access to shipments" 
    ON public.shipments FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==========================================
-- AUTOMATION TRIGGERS FOR PROFILES
-- ==========================================

-- Automatically create a profile in public.user_permissions when a user registers on Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_permissions (id, email, company_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'company_name', 'Customer Corp'),
    COALESCE(new.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- SEED DATA FOR VALIDATION
-- ==========================================

-- A. SEED CUSTOMERS
INSERT INTO public.customers (customer_id, customer_name, country, contact_person, email) VALUES
('CUST-01', 'Apex Global Logistics', 'United States', 'Sarah Jenkins', 'customer@apex.com'),
('CUST-02', 'Vortex Industrial Co', 'Germany', 'Hans Müller', 'client@vortex.de'),
('CUST-03', 'Oceanic Trade Partners', 'Singapore', 'Linda Tan', 'oceanic@trade.sg');

-- B. SEED PURCHASE ORDERS
INSERT INTO public.purchase_orders (po_no, customer_id, po_date, total_amount_usd, payment_term, sales_person_id) VALUES
('PO-2601-A', 'CUST-01', '2026-05-10', 125000.00, '30 Days Net', 'SALES-09'),
('PO-2602-B', 'CUST-01', '2026-05-12', 45000.00, 'Letter of Credit', 'SALES-09'),
('PO-2603-C', 'CUST-02', '2026-05-15', 380000.00, '50% Advance / 50% CAD', 'SALES-04'),
('PO-2604-D', 'CUST-03', '2026-05-20', 98000.00, '60 Days Net', 'SALES-02');

-- C. SEED SHIPMENTS (Delivery Instructions)
INSERT INTO public.shipments (di_no, po_no, status, product_id, quantity_tons, container_no, seal_no, forwarder_id, vessel_voyage, shipment_type, etd_date, eta_date, bl_draft_link, shipping_docs_link, booking_no, invoice_no, container_size, bl_approval_status, bl_feedback) VALUES
-- Apex PO-2601-A Shipments
('DI-2601-A1', 'PO-2601-A', 'pending_production', 'PROD-AUSTENITE-22', 50.000, NULL, NULL, NULL, NULL, 'container', NULL, NULL, NULL, NULL, NULL, 'WCAT001', '20\'', 'pending', NULL),
('DI-2601-A2', 'PO-2601-A', 'loaded_into_container', 'PROD-FERRITIC-11', 25.500, 'MSCU9827361', 'SEAL-992837', 'Maersk Logistics', 'MAERSK MC-KINNEY MØLLER / Voyage 2601W', 'container', '2026-06-01', '2026-06-20', NULL, NULL, 'BK-2601-99', 'WCAT002', '40\'', 'pending', NULL),
('DI-2601-A3', 'PO-2601-A', 'awaiting_bl_confirmation', 'PROD-DUPLEX-05', 40.000, 'CMAU2819283', 'SEAL-228192', 'CMA CGM', 'CMA CGM MARCO POLO / Voyage 2602E', 'bulk', '2026-05-28', '2026-06-15', 'https://example.com/drafts/bl-2601-a3.pdf', NULL, 'BK-2601-88', 'WCAT003', '40\' HQ', 'pending', NULL),
('DI-2601-A4', 'PO-2601-A', 'eta', 'PROD-AUSTENITE-22', 20.000, 'OOCL8827182', 'SEAL-882736', 'OOCL', 'OOCL HONG KONG / Voyage 2603N', 'domestic', '2026-05-12', '2026-05-24', 'https://example.com/drafts/bl-approved.pdf', 'https://example.com/docs/shipping-docs-2601-a4.zip', 'BK-2601-77', 'WCAT004', '20\'', 'approved', 'Draft looks perfect! Passed inspection.'),

-- Apex PO-2602-B Shipments
('DI-2602-B1', 'PO-2602-B', 'pending_packaging', 'PROD-NICKEL-88', 12.000, NULL, NULL, NULL, NULL, 'container', NULL, NULL, NULL, NULL, NULL, 'WCAT005', '40\'', 'pending', NULL),

-- Vortex PO-2603-C Shipments
('DI-2603-C1', 'PO-2603-C', 'awaiting_loading', 'PROD-SPECIAL-09', 100.000, NULL, NULL, 'DHL Global', 'MV. COSCO SHIPPING / V.240E', 'bulk', '2026-06-05', '2026-06-30', NULL, NULL, NULL, 'WCAT006', '40\' HQ', 'pending', NULL),
('DI-2603-C2', 'PO-2603-C', 'awaiting_all_docs', 'PROD-SPECIAL-09', 150.000, 'HLXU1182736', 'SEAL-110293', 'Hapag-Lloyd', 'HAPAG-LLOYD AL DAHNA / Voyage 2605W', 'container', '2026-05-20', '2026-06-18', 'https://example.com/drafts/bl-vortex-approved.pdf', NULL, 'BK-2603-12', 'WCAT007', '20\'', 'approved', 'B/L confirmed by Hans Müller.'),

-- Oceanic PO-2604-D Shipments
('DI-2604-D1', 'PO-2604-D', 'etd', 'PROD-TITANIUM-04', 15.000, 'ONEU7728362', 'SEAL-773829', 'ONE Line', 'ONE APUS / Voyage 2606E', 'domestic', '2026-05-22', '2026-06-02', 'https://example.com/drafts/bl-oceanic.pdf', 'https://example.com/docs/oceanic-docs.zip', 'BK-2604-04', 'WCAT008', '40\' HQ', 'approved', NULL);
