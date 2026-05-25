import { createClient } from "@supabase/supabase-js";

// Determine if we have live Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isLiveSupabase = supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = isLiveSupabase 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// ==========================================
// INTERFACES
// ==========================================

export interface UserProfile {
  id: string;
  email: string;
  company_name: string;
  role: "admin" | "customer" | "manager";
}

export interface Customer {
  customer_id: string;
  customer_name: string;
  country: string;
  contact_person: string;
  email: string;
}

export interface PurchaseOrder {
  po_no: string;
  customer_id: string;
  po_date: string;
  total_amount_usd: number;
  payment_term: string;
  sales_person_id: string;
}

export interface Shipment {
  di_no: string;
  po_no: string;
  status: 
    | "pending_production"
    | "pending_packaging"
    | "awaiting_loading"
    | "loaded_into_container"
    | "awaiting_bl_confirmation"
    | "awaiting_all_docs"
    | "etd"
    | "eta";
  product_id: string;
  quantity_tons: number;
  container_no?: string | null;
  seal_no?: string | null;
  forwarder_id?: string | null;
  vessel_voyage?: string | null;
  etd_date?: string | null;
  eta_date?: string | null;
  bl_draft_link?: string | null;
  shipping_docs_link?: string | null;
  bl_approval_status?: "pending" | "approved" | "rejected";
  bl_feedback?: string | null;
  booking_no?: string | null;
  invoice_no?: string | null;
  container_size?: string | null;
  container_qty?: number | null;
  loading_start_date?: string | null;
  loading_end_date?: string | null;
  loading_splits?: Array<{ date: string; qty: number }> | null;
  doc_status?: "get_booking" | "preparing_docs" | "confirm_bl" | "bl_stage" | "confirm_draft_docs" | "all_ship_docs_completed" | null;
  shipment_type?: "container" | "bulk" | "domestic" | null;
  product_info?: string | null;
  weight_mt?: number | null;
  contract_value?: number | null;
  destination_country?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Master Dropdowns
export const FORWARDERS = [
  "Maersk Logistics",
  "CMA CGM",
  "DHL Global",
  "Hapag-Lloyd",
  "ONE Line",
  "Evergreen Marine",
  "Cosco Shipping"
];

export const VESSELS = [
  "MAERSK MC-KINNEY MØLLER / Voyage 2601W",
  "CMA CGM MARCO POLO / Voyage 2602E",
  "OOCL HONG KONG / Voyage 2603N",
  "MV. COSCO SHIPPING / V.240E",
  "HAPAG-LLOYD AL DAHNA / Voyage 2605W",
  "ONE APUS / Voyage 2606E",
  "EVER ALOT / Voyage 2607N"
];

// Keep TRUCKS as alias for backward compatibility
export const TRUCKS = VESSELS;

// ==========================================
// LOCAL STORAGE BACKEND FALLBACK
// ==========================================

const LOCAL_STORAGE_KEYS = {
  PROFILE: "wcat_profile",
  CUSTOMERS: "wcat_customers",
  POS: "wcat_pos",
  SHIPMENTS: "wcat_shipments"
};

// Seed Mock Data
const MOCK_CUSTOMERS: Customer[] = [
  { customer_id: "CUST-01", customer_name: "Apex Global Logistics", country: "United States", contact_person: "Sarah Jenkins", email: "customer@apex.com" },
  { customer_id: "CUST-02", customer_name: "Vortex Industrial Co", country: "Germany", contact_person: "Hans Müller", email: "client@vortex.de" },
  { customer_id: "CUST-03", customer_name: "Oceanic Trade Partners", country: "Singapore", contact_person: "Linda Tan", email: "oceanic@trade.sg" }
];

const MOCK_POS: PurchaseOrder[] = [
  { po_no: "PO-2601-A", customer_id: "CUST-01", po_date: "2026-05-10", total_amount_usd: 125000, payment_term: "30 Days Net", sales_person_id: "SALES-09" },
  { po_no: "PO-2602-B", customer_id: "CUST-01", po_date: "2026-05-12", total_amount_usd: 45000, payment_term: "Letter of Credit", sales_person_id: "SALES-09" },
  { po_no: "PO-2603-C", customer_id: "CUST-02", po_date: "2026-05-15", total_amount_usd: 380000, payment_term: "50% Advance / 50% CAD", sales_person_id: "SALES-04" },
  { po_no: "PO-2604-D", customer_id: "CUST-03", po_date: "2026-05-20", total_amount_usd: 98000, payment_term: "60 Days Net", sales_person_id: "SALES-02" }
];

const MOCK_SHIPMENTS: Shipment[] = [
  // Apex PO-2601-A DIs (Seeding initial ETD dates to demonstrate Green state capacity)
  { di_no: "DI-2601-A1", po_no: "PO-2601-A", status: "pending_production", product_id: "PROD-AUSTENITE-22", quantity_tons: 50.000, invoice_no: "WCAT001", container_size: "40'", container_qty: 1, etd_date: "2026-05-25", doc_status: "preparing_docs", shipment_type: "container", product_info: "Tapioca Flour Extra", weight_mt: 50.000, contract_value: 32500, destination_country: "United States" },
  { di_no: "DI-2601-A2", po_no: "PO-2601-A", status: "loaded_into_container", product_id: "PROD-AUSTENITE-22", quantity_tons: 25.500, container_no: "MSCU9827361", seal_no: "SEAL-992837", forwarder_id: "Maersk Logistics", vessel_voyage: "MAERSK MC-KINNEY MØLLER / Voyage 2601W", etd_date: "2026-05-26", eta_date: "2026-06-20", booking_no: "BK-2601-99", invoice_no: "WCAT002", container_size: "40'", container_qty: 2, doc_status: "bl_stage", shipment_type: "container", product_info: "Sweet Potato Powder", weight_mt: 25.500, contract_value: 18000, destination_country: "United States" },
  { di_no: "DI-2601-A3", po_no: "PO-2601-A", status: "awaiting_bl_confirmation", product_id: "PROD-SPECIAL-09", quantity_tons: 40.000, container_no: "CMAU2819283", seal_no: "SEAL-228192", forwarder_id: "CMA CGM", vessel_voyage: "CMA CGM MARCO POLO / Voyage 2602E", etd_date: "2026-05-28", eta_date: "2026-06-15", bl_draft_link: "https://example.com/drafts/bl-2601-a3.pdf", bl_approval_status: "pending", booking_no: "BK-2601-88", invoice_no: "WCAT003", container_size: "Bulk Vessel", container_qty: 3, doc_status: "confirm_draft_docs", shipment_type: "bulk", product_info: "Tapioca Pearls Premium", weight_mt: 40.000, contract_value: 29000, destination_country: "Germany" },
  { di_no: "DI-2601-A4", po_no: "PO-2601-A", status: "eta", product_id: "PROD-SPECIAL-09", quantity_tons: 20.000, container_no: "OOCL8827182", seal_no: "SEAL-882736", forwarder_id: "OOCL", vessel_voyage: "OOCL HONG KONG / Voyage 2603N", etd_date: "2026-06-01", eta_date: "2026-06-12", bl_draft_link: "https://example.com/drafts/bl-approved.pdf", shipping_docs_link: "https://example.com/docs/shipping-docs-2601-a4.zip", bl_approval_status: "approved", bl_feedback: "Draft looks perfect! Passed inspection.", booking_no: "BK-2601-77", invoice_no: "WCAT004", container_size: "Bulk Vessel", container_qty: 2, doc_status: "all_ship_docs_completed", shipment_type: "bulk", product_info: "Pumpkin Flour Organic", weight_mt: 20.000, contract_value: 15500, destination_country: "Singapore" },
  
  // Vortex PO-2603-C DIs
  { di_no: "DI-2603-C1", po_no: "PO-2603-C", status: "awaiting_loading", product_id: "PROD-SPECIAL-09", quantity_tons: 100.000, forwarder_id: "DHL Global", vessel_voyage: "MV. COSCO SHIPPING / V.240E", etd_date: "2026-05-29", eta_date: "2026-06-30", invoice_no: "WCAT006", container_size: "Truck", container_qty: 4, shipment_type: "domestic", product_info: "Tapioca Flour Extra", weight_mt: 100.000, contract_value: 65000, destination_country: "Germany" },
  { di_no: "DI-2603-C2", po_no: "PO-2603-C", status: "awaiting_all_docs", product_id: "PROD-SPECIAL-09", quantity_tons: 150.000, container_no: "HLXU1182736", seal_no: "SEAL-110293", forwarder_id: "Hapag-Lloyd", vessel_voyage: "HAPAG-LLOYD AL DAHNA / Voyage 2605W", etd_date: "2026-06-10", eta_date: "2026-06-25", bl_draft_link: "https://example.com/drafts/bl-vortex-approved.pdf", bl_approval_status: "approved", bl_feedback: "B/L confirmed by Hans Müller.", booking_no: "BK-2603-12", invoice_no: "WCAT007", container_size: "Truck", container_qty: 2, shipment_type: "domestic", product_info: "Sweet Potato Powder", weight_mt: 150.000, contract_value: 98000, destination_country: "Singapore" },

  // Vortex Special 09 20' Container Row (Mixed)
  { di_no: "DI-2603-C7", po_no: "PO-2603-C", status: "etd", product_id: "PROD-SPECIAL-09", quantity_tons: 15.000, container_no: "ONEU7728362", seal_no: "SEAL-773829", forwarder_id: "ONE Line", vessel_voyage: "ONE APUS / Voyage 2606E", etd_date: "2026-05-30", eta_date: "2026-06-02", bl_draft_link: "https://example.com/drafts/bl-oceanic.pdf", shipping_docs_link: "https://example.com/docs/oceanic-docs.zip", bl_approval_status: "approved", booking_no: "BK-2604-04", invoice_no: "WCAT008", container_size: "20'", container_qty: 2, shipment_type: "container", product_info: "Pumpkin Flour Organic", weight_mt: 15.000, contract_value: 11000, destination_country: "Japan" },

  // Apex PO-2602-B DIs
  { di_no: "DI-2602-B1", po_no: "PO-2602-B", status: "pending_packaging", product_id: "PROD-NICKEL-88", quantity_tons: 12.000, invoice_no: "WCAT005", container_size: "40'", container_qty: 3, etd_date: "2026-05-27", shipment_type: "container", product_info: "Tapioca Flour Extra", weight_mt: 12.000, contract_value: 8500, destination_country: "China" },

  // ==========================================
  // HEATMAP SIMULATION DATA (May 2026)
  // ==========================================

  // Yellow Day 1: May 10, 2026 (7 containers loaded)
  { di_no: "DI-2601-A5", po_no: "PO-2601-A", status: "awaiting_loading", product_id: "PROD-AUSTENITE-22", quantity_tons: 80.000, etd_date: "2026-05-10", booking_no: "BK-2601-05", invoice_no: "WCAT009", container_size: "40'", container_qty: 4, product_info: "Tapioca Flour Extra", weight_mt: 80.000, contract_value: 52000, destination_country: "United States" },
  { di_no: "DI-2601-A6", po_no: "PO-2601-A", status: "loaded_into_container", product_id: "PROD-FERRITIC-11", quantity_tons: 35.000, etd_date: "2026-05-10", booking_no: "BK-2601-06", invoice_no: "WCAT010", container_size: "20'", container_qty: 3, product_info: "Sweet Potato Powder", weight_mt: 35.000, contract_value: 24500, destination_country: "United States" },

  // Orange Day 1: May 12, 2026 (12 containers loaded)
  { di_no: "DI-2601-A7", po_no: "PO-2601-A", status: "loaded_into_container", product_id: "PROD-DUPLEX-05", quantity_tons: 100.000, etd_date: "2026-05-12", booking_no: "BK-2601-07", invoice_no: "WCAT011", container_size: "40' HQ", container_qty: 5, product_info: "Tapioca Pearls Premium", weight_mt: 100.000, contract_value: 75000, destination_country: "Germany" },
  { di_no: "DI-2601-A8", po_no: "PO-2601-A", status: "awaiting_loading", product_id: "PROD-AUSTENITE-22", quantity_tons: 80.000, etd_date: "2026-05-12", booking_no: "BK-2601-08", invoice_no: "WCAT012", container_size: "40'", container_qty: 4, product_info: "Pumpkin Flour Organic", weight_mt: 80.000, contract_value: 62000, destination_country: "Singapore" },
  { di_no: "DI-2603-C3", po_no: "PO-2603-C", status: "awaiting_loading", product_id: "PROD-SPECIAL-09", quantity_tons: 45.000, etd_date: "2026-05-12", booking_no: "BK-2603-03", invoice_no: "WCAT013", container_size: "20'", container_qty: 3, product_info: "Tapioca Flour Extra", weight_mt: 45.000, contract_value: 29250, destination_country: "Germany" },

  // Yellow Day 2: May 15, 2026 (8 containers loaded)
  { di_no: "DI-2603-C4", po_no: "PO-2603-C", status: "loaded_into_container", product_id: "PROD-SPECIAL-09", quantity_tons: 65.000, etd_date: "2026-05-15", booking_no: "BK-2603-04", invoice_no: "WCAT014", container_size: "20'", container_qty: 5, product_info: "Sweet Potato Powder", weight_mt: 65.000, contract_value: 45500, destination_country: "Singapore" },
  { di_no: "DI-2603-C5", po_no: "PO-2603-C", status: "awaiting_bl_confirmation", product_id: "PROD-SPECIAL-09", quantity_tons: 60.000, etd_date: "2026-05-15", booking_no: "BK-2603-05", invoice_no: "WCAT015", container_size: "40' HQ", container_qty: 3, product_info: "Pumpkin Flour Organic", weight_mt: 60.000, contract_value: 46500, destination_country: "Japan" },

  // Orange Day 2: May 18, 2026 (14 containers loaded)
  { di_no: "DI-2603-C6", po_no: "PO-2603-C", status: "eta", product_id: "PROD-SPECIAL-09", quantity_tons: 120.000, etd_date: "2026-05-18", booking_no: "BK-2603-06", invoice_no: "WCAT016", container_size: "40'", container_qty: 6, product_info: "Tapioca Flour Extra", weight_mt: 120.000, contract_value: 78000, destination_country: "Germany" },
  { di_no: "DI-2604-D2", po_no: "PO-2604-D", status: "etd", product_id: "PROD-TITANIUM-04", quantity_tons: 50.000, etd_date: "2026-05-18", booking_no: "BK-2604-02", invoice_no: "WCAT017", container_size: "20'", container_qty: 4, product_info: "Sweet Potato Powder", weight_mt: 50.000, contract_value: 35000, destination_country: "United States" },
  { di_no: "DI-2604-D3", po_no: "PO-2604-D", status: "awaiting_all_docs", product_id: "PROD-TITANIUM-04", quantity_tons: 90.000, etd_date: "2026-05-18", booking_no: "BK-2604-03", invoice_no: "WCAT018", container_size: "40' HQ", container_qty: 4, product_info: "Tapioca Pearls Premium", weight_mt: 90.000, contract_value: 67500, destination_country: "China" },

  // Yellow Day 3: May 20, 2026 (9 containers loaded)
  { di_no: "DI-2604-D4", po_no: "PO-2604-D", status: "etd", product_id: "PROD-TITANIUM-04", quantity_tons: 110.000, etd_date: "2026-05-20", booking_no: "BK-2604-04", invoice_no: "WCAT019", container_size: "40'", container_qty: 6, product_info: "Pumpkin Flour Organic", weight_mt: 110.000, contract_value: 85250, destination_country: "Japan" },
  { di_no: "DI-2604-D5", po_no: "PO-2604-D", status: "awaiting_bl_confirmation", product_id: "PROD-TITANIUM-04", quantity_tons: 35.000, etd_date: "2026-05-20", booking_no: "BK-2604-05", invoice_no: "WCAT020", container_size: "20'", container_qty: 3, product_info: "Tapioca Flour Extra", weight_mt: 35.000, contract_value: 22750, destination_country: "Singapore" }
];

const initializeLocalStorage = () => {
  if (typeof window === "undefined") return;

  const version = "v8"; // Bust cache and force reload mock shipments with commercial metrics
  const currentVersion = localStorage.getItem("wcat_seed_version");
  if (currentVersion !== version) {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.POS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SHIPMENTS);
    localStorage.setItem("wcat_seed_version", version);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOMERS)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOMERS, JSON.stringify(MOCK_CUSTOMERS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEYS.POS)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.POS, JSON.stringify(MOCK_POS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPMENTS)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SHIPMENTS, JSON.stringify(MOCK_SHIPMENTS));
  }
};

// Ensure seed data exists
initializeLocalStorage();

// ==========================================
// LOGISTICS DATA ACCESS LAYER API
// ==========================================

export async function loginUser(email: string, roleInput: "admin" | "customer"): Promise<UserProfile> {
  if (isLiveSupabase && supabase) {
    // Standard Supabase login can go here, but for smooth standalone running:
    // We emulate profile creation and return
  }

  // Local storage mock authentication
  initializeLocalStorage();
  const lowerEmail = email.toLowerCase();
  
  let role: "admin" | "customer" = roleInput;
  let company_name = "Apex Global Logistics";

  if (lowerEmail.includes("admin")) {
    role = "admin";
    company_name = "WICHAI AGRI-TRADE CO.,LTD";
  } else if (lowerEmail.includes("client") || lowerEmail.includes("vortex")) {
    role = "customer";
    company_name = "Vortex Industrial Co";
  } else if (lowerEmail.includes("oceanic")) {
    role = "customer";
    company_name = "Oceanic Trade Partners";
  }

  const profile: UserProfile = {
    id: `mock-uuid-${role}-${lowerEmail}`,
    email: lowerEmail,
    company_name,
    role
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }
  return profile;
}

export function getCurrentUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.PROFILE);
  return raw ? JSON.parse(raw) : null;
}

export function logoutUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PROFILE);
  }
}

export async function getCustomers(): Promise<Customer[]> {
  if (isLiveSupabase && supabase) {
    const { data, error } = await supabase.from("customers").select("*");
    if (!error && data) return data as Customer[];
  }

  initializeLocalStorage();
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOMERS);
  return raw ? JSON.parse(raw) : MOCK_CUSTOMERS;
}

export async function getPurchaseOrders(customerEmail?: string): Promise<PurchaseOrder[]> {
  if (isLiveSupabase && supabase) {
    let query = supabase.from("purchase_orders").select("*");
    // If client, we filter down
    if (customerEmail) {
      const { data: clientData } = await supabase
        .from("customers")
        .select("customer_id")
        .eq("email", customerEmail)
        .single();
      if (clientData) {
        query = query.eq("customer_id", clientData.customer_id);
      }
    }
    const { data, error } = await query;
    if (!error && data) return data as PurchaseOrder[];
  }

  initializeLocalStorage();
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.POS);
  const pos: PurchaseOrder[] = raw ? JSON.parse(raw) : MOCK_POS;

  if (customerEmail) {
    // Find customer_id matching the email
    const custs = await getCustomers();
    const targetCust = custs.find(c => c.email.toLowerCase() === customerEmail.toLowerCase());
    if (targetCust) {
      return pos.filter(po => po.customer_id === targetCust.customer_id);
    }
    return [];
  }
  return pos;
}

export async function getShipments(poNos?: string[]): Promise<Shipment[]> {
  if (isLiveSupabase && supabase) {
    let query = supabase.from("shipments").select("*");
    if (poNos && poNos.length > 0) {
      query = query.in("po_no", poNos);
    }
    const { data, error } = await query;
    if (!error && data) return data as Shipment[];
  }

  initializeLocalStorage();
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPMENTS);
  const shipments: Shipment[] = raw ? JSON.parse(raw) : MOCK_SHIPMENTS;

  if (poNos && poNos.length > 0) {
    return shipments.filter(ship => poNos.includes(ship.po_no));
  }
  return shipments;
}

export async function updateShipment(diNo: string, updates: Partial<Shipment>): Promise<Shipment> {
  if (isLiveSupabase && supabase) {
    const { data, error } = await supabase
      .from("shipments")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("di_no", diNo)
      .select()
      .single();
    if (!error && data) return data as Shipment;
  }

  initializeLocalStorage();
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPMENTS);
  const shipments: Shipment[] = raw ? JSON.parse(raw) : MOCK_SHIPMENTS;
  
  const index = shipments.findIndex(s => s.di_no === diNo);
  if (index === -1) throw new Error("Shipment not found");

  const updatedShipment = {
    ...shipments[index],
    ...updates,
    updated_at: new Date().toISOString()
  };

  shipments[index] = updatedShipment;
  localStorage.setItem(LOCAL_STORAGE_KEYS.SHIPMENTS, JSON.stringify(shipments));
  return updatedShipment;
}

export async function createPurchaseOrder(po: PurchaseOrder, shipments: Shipment[]): Promise<boolean> {
  if (isLiveSupabase && supabase) {
    const { error: poError } = await supabase.from("purchase_orders").insert(po);
    if (poError) return false;

    const { error: shipError } = await supabase.from("shipments").insert(shipments);
    return !shipError;
  }

  initializeLocalStorage();
  const rawPOs = localStorage.getItem(LOCAL_STORAGE_KEYS.POS);
  const pos: PurchaseOrder[] = rawPOs ? JSON.parse(rawPOs) : MOCK_POS;
  pos.push(po);
  localStorage.setItem(LOCAL_STORAGE_KEYS.POS, JSON.stringify(pos));

  const rawShips = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPMENTS);
  const ships: Shipment[] = rawShips ? JSON.parse(rawShips) : MOCK_SHIPMENTS;
  ships.push(...shipments);
  localStorage.setItem(LOCAL_STORAGE_KEYS.SHIPMENTS, JSON.stringify(ships));

  return true;
}

export async function updateShipmentsBulk(
  diNos: string[],
  updates: Partial<Shipment>
): Promise<boolean> {
  if (isLiveSupabase && supabase) {
    const { error } = await supabase
      .from("shipments")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in("di_no", diNos);
    return !error;
  }

  initializeLocalStorage();
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPMENTS);
  const shipments: Shipment[] = raw ? JSON.parse(raw) : MOCK_SHIPMENTS;

  diNos.forEach(diNo => {
    const index = shipments.findIndex(s => s.di_no === diNo);
    if (index !== -1) {
      shipments[index] = {
        ...shipments[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
    }
  });

  localStorage.setItem(LOCAL_STORAGE_KEYS.SHIPMENTS, JSON.stringify(shipments));
  return true;
}
