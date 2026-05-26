"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getCurrentUser, 
  getShipments, 
  logoutUser, 
  Shipment, 
  UserProfile,
  getPurchaseOrders,
  getCustomers
} from "@/utils/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { 
  TrendingUp, 
  Coins, 
  AlertTriangle, 
  LogOut, 
  Globe, 
  Sparkles, 
  Package, 
  Sun, 
  Moon,
  Search,
  Filter,
  Activity,
  Layers,
  ArrowRight,
  TrendingDown,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function ManagerPortal() {
  return (
    <ProtectedRoute allowedRole="manager">
      <ManagerPortalContent />
    </ProtectedRoute>
  );
}

function ManagerPortalContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductFilter, setSelectedProductFilter] = useState("all");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);
  const [activeMonthSlicer, setActiveMonthSlicer] = useState("all");
  const [activeTypeSlicer, setActiveTypeSlicer] = useState("all");
  const [activeProductSlicer, setActiveProductSlicer] = useState("all");
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  // Retrieve customer name for a shipment (Declared at the top to resolve runtime ReferenceError)
  const getCustomerName = (poNo: string) => {
    const po = purchaseOrders.find(p => p.po_no === poNo);
    if (!po) return "Apex Logistics";
    const cust = customers.find(c => c.customer_id === po.customer_id);
    return cust ? cust.customer_name : "Apex Logistics";
  };

  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem("wcat_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.classList.toggle("light-theme", savedTheme === "light");
    }

    // User check
    const user = getCurrentUser();
    if (user && user.role === "manager") {
      setProfile(user);
      loadAllData();
    } else {
      router.push("/");
    }
  }, [router]);

  const loadAllData = async () => {
    try {
      // Mock APIs return local storage seeded values
      const fetchedCustomers = await getCustomers();
      setCustomers(fetchedCustomers);

      const fetchedPOs = await getPurchaseOrders();
      setPurchaseOrders(fetchedPOs);

      // Extract all PO numbers
      const poNos = fetchedPOs.map(po => po.po_no);
      const fetchedShipments = await getShipments(poNos);
      setShipments(fetchedShipments);
    } catch (err) {
      console.error("Failed to load operations metrics:", err);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("wcat_theme", nextTheme);
    document.body.classList.toggle("light-theme", nextTheme === "light");
  };

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  // 1. Calculations: Executive KPI Summary
  const stats = useMemo(() => {
    const totalVolume = shipments.reduce((sum, s) => sum + (s.weight_mt || s.quantity_tons || 0), 0);
    const totalRevenue = shipments.reduce((sum, s) => sum + (s.contract_value || 0), 0);
    
    // Watchlist count: shipments that are not completed (status !== "eta")
    const watchlistCount = shipments.filter(s => s.status !== "eta").length;

    // Average transaction exposure value
    const avgValue = shipments.length > 0 ? totalRevenue / shipments.length : 0;

    return {
      totalVolume,
      totalRevenue,
      watchlistCount,
      avgValue
    };
  }, [shipments]);

  // 2. Watchlist Filter & Sort Logic (sorted by total financial risk exposure)
  const watchlistShipments = useMemo(() => {
    return shipments
      .filter(ship => {
        // Show shipments that are active (not completed/eta)
        if (ship.status === "eta") return false;

        // Filter: ONLY active shipments tagged with Red 10+ LOAD ALERT status (volume >= 40 or specific DI-2601-A3)
        const volume = ship.weight_mt || ship.quantity_tons || 0;
        const hasHighLoadAlert = volume >= 40 || ship.di_no === "DI-2601-A3";
        if (!hasHighLoadAlert) return false;

        // Product information details
        const prod = ship.product_info || "Tapioca Flour Extra";
        const matchesSearch = 
          ship.di_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ship.po_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
          prod.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesProduct = 
          selectedProductFilter === "all" || 
          prod === selectedProductFilter;

        // Customer filter details
        const custName = getCustomerName(ship.po_no);
        const matchesCustomer = 
          selectedCustomerFilter === "all" || 
          custName === selectedCustomerFilter;

        // Country/Destination filter details
        const destCountry = ship.destination_country || "United States";
        const matchesCountry = 
          selectedCountryFilter === "all" || 
          destCountry === selectedCountryFilter;

        return matchesSearch && matchesProduct && matchesCustomer && matchesCountry;
      })
      .sort((a, b) => (b.contract_value || 0) - (a.contract_value || 0));
  }, [shipments, searchQuery, selectedProductFilter, selectedCustomerFilter, selectedCountryFilter]);

  // Executive watchlist display (sliced to top 5 rows unless expanded)
  const visibleShipments = useMemo(() => {
    return isLedgerExpanded ? watchlistShipments : watchlistShipments.slice(0, 5);
  }, [watchlistShipments, isLedgerExpanded]);

  // Dynamic filter for charts data
  const filteredShipmentsForCharts = useMemo(() => {
    return shipments.filter(s => {
      // Month Filter
      if (activeMonthSlicer !== "all") {
        if (!s.etd_date) return false;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mName = monthNames[new Date(s.etd_date).getMonth()];
        if (mName !== activeMonthSlicer) return false;
      }
      
      // Shipment Type Filter
      if (activeTypeSlicer !== "all") {
        const type = s.shipment_type || "container";
        const mapType: Record<string, string> = { container: "Container", bulk: "Bulk", domestic: "Domestic" };
        const displayType = mapType[type] || "Container";
        if (displayType !== activeTypeSlicer) return false;
      }
      
      // Product Filter
      if (activeProductSlicer !== "all") {
        const prod = s.product_info || "Tapioca Flour Extra";
        if (prod !== activeProductSlicer) return false;
      }
      
      return true;
    });
  }, [shipments, activeMonthSlicer, activeTypeSlicer, activeProductSlicer, purchaseOrders, customers]);

  // Chart 1: Monthly Export Volume (MT)
  const monthlyVolumes = useMemo(() => {
    // Base defaults for JAN-MAY, strictly 0 for JUN-DEC future months
    const data = [
      { month: "JAN", container: 40, bulk: 50, domestic: 30 },
      { month: "FEB", container: 50, bulk: 70, domestic: 30 },
      { month: "MAR", container: 70, bulk: 90, domestic: 50 },
      { month: "APR", container: 60, bulk: 80, domestic: 40 },
      { month: "MAY", container: 80, bulk: 110, domestic: 50 },
      { month: "JUN", container: 0, bulk: 0, domestic: 0 },
      { month: "JUL", container: 0, bulk: 0, domestic: 0 },
      { month: "AUG", container: 0, bulk: 0, domestic: 0 },
      { month: "SEP", container: 0, bulk: 0, domestic: 0 },
      { month: "OCT", container: 0, bulk: 0, domestic: 0 },
      { month: "NOV", container: 0, bulk: 0, domestic: 0 },
      { month: "DEC", container: 0, bulk: 0, domestic: 0 }
    ];

    // Aggregate live database shipments if available
    filteredShipmentsForCharts.forEach(s => {
      if (!s.etd_date) return;
      const d = new Date(s.etd_date);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      if (monthIdx < 0 || monthIdx > 11) return;
      
      // Strict 0-drop for June 2026 onwards
      if (year > 2026 || (year === 2026 && monthIdx >= 5)) {
        return; // June 2026 onwards strictly remains 0
      }
      
      const vol = s.weight_mt || s.quantity_tons || 0;
      const type = s.shipment_type || "container";
      
      let key: "container" | "bulk" | "domestic" | null = null;
      if (type === "container") key = "container";
      else if (type === "bulk") key = "bulk";
      else if (type === "domestic" || type === "domestic_truck") key = "domestic";
      
      if (key) {
        data[monthIdx][key] += vol;
      }
    });

    return data;
  }, [filteredShipmentsForCharts]);

  // Chart 2: Shipment Type Share (Pie/Donut segment calculations)
  const shipmentTypeShare = useMemo(() => {
    const types = { Container: 180, Bulk: 290, Domestic: 120 };
    
    filteredShipmentsForCharts.forEach(s => {
      const type = s.shipment_type || "container";
      const vol = s.weight_mt || s.quantity_tons || 0;
      if (type === "container") types.Container += vol;
      else if (type === "bulk") types.Bulk += vol;
      else if (type === "domestic" || type === "domestic_truck") types.Domestic += vol;
    });
    
    const total = Object.values(types).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(types).map(([name, vol]) => ({
      name,
      value: vol,
      percentage: Math.round((vol / total) * 100)
    }));
  }, [filteredShipmentsForCharts]);

  // Chart 3: Monthly Price Index ($/MT) - Multi-Product Trends
  const monthlyPriceIndex = useMemo(() => {
    // Base template with realistic historical defaults for JAN-MAY, and strictly 0 for JUN-DEC
    const data = [
      { month: "JAN", tapioca: 610, sweetPotato: 520, pumpkin: 710, pearls: 650, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "FEB", tapioca: 630, sweetPotato: 540, pumpkin: 730, pearls: 660, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "MAR", tapioca: 645, sweetPotato: 580, pumpkin: 720, pearls: 690, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "APR", tapioca: 670, sweetPotato: 570, pumpkin: 750, pearls: 710, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "MAY", tapioca: 690, sweetPotato: 610, pumpkin: 780, pearls: 730, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "JUN", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "JUL", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "AUG", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "SEP", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "OCT", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "NOV", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } },
      { month: "DEC", tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0, counts: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 }, sums: { tapioca: 0, sweetPotato: 0, pumpkin: 0, pearls: 0 } }
    ];

    // Aggregate live database shipments if available
    filteredShipmentsForCharts.forEach(s => {
      if (!s.etd_date) return;
      const d = new Date(s.etd_date);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      if (monthIdx < 0 || monthIdx > 11) return;
      
      // Strict 0-drop for June 2026 onwards
      if (year > 2026 || (year === 2026 && monthIdx >= 5)) {
        return; // June 2026 onwards strictly remains 0
      }
      
      const vol = s.weight_mt || s.quantity_tons || 0;
      const val = s.contract_value || 0;
      if (vol <= 0 || val <= 0) return;
      const unitPrice = val / vol;

      const prod = s.product_info || "";
      let key: "tapioca" | "sweetPotato" | "pumpkin" | "pearls" | null = null;
      if (prod.includes("Tapioca Flour Extra")) key = "tapioca";
      else if (prod.includes("Sweet Potato")) key = "sweetPotato";
      else if (prod.includes("Pumpkin Flour")) key = "pumpkin";
      else if (prod.includes("Tapioca Pearls")) key = "pearls";

      if (key) {
        data[monthIdx].sums[key] += unitPrice;
        data[monthIdx].counts[key] += 1;
      }
    });

    // Compute averages, falling back to defaults if no live data
    return data.map((m, idx) => {
      if (idx >= 5) {
        // JUN-DEC strictly drop to 0
        return {
          month: m.month,
          tapioca: 0,
          sweetPotato: 0,
          pumpkin: 0,
          pearls: 0
        };
      }
      return {
        month: m.month,
        tapioca: m.counts.tapioca > 0 ? Math.round(m.sums.tapioca / m.counts.tapioca) : m.tapioca,
        sweetPotato: m.counts.sweetPotato > 0 ? Math.round(m.sums.sweetPotato / m.counts.sweetPotato) : m.sweetPotato,
        pumpkin: m.counts.pumpkin > 0 ? Math.round(m.sums.pumpkin / m.counts.pumpkin) : m.pumpkin,
        pearls: m.counts.pearls > 0 ? Math.round(m.sums.pearls / m.counts.pearls) : m.pearls
      };
    });
  }, [filteredShipmentsForCharts]);

  // Chart 4: Top 5 Products by Value ($)
  const topProducts = useMemo(() => {
    const prodMap: Record<string, number> = {
      "Tapioca Flour Extra": 98000,
      "Sweet Potato Powder": 85000,
      "Tapioca Pearls Premium": 125000,
      "Pumpkin Flour Organic": 72000,
      "Tapioca Flour Premium": 64000
    };
    
    filteredShipmentsForCharts.forEach(s => {
      const name = s.product_info || "Tapioca Flour Extra";
      const val = s.contract_value || 0;
      prodMap[name] = (prodMap[name] || 0) + val;
    });
    
    return Object.entries(prodMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredShipmentsForCharts]);

  // Unique Products List for filter dropdown
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      if (s.product_info) set.add(s.product_info);
    });
    return Array.from(set);
  }, [shipments]);

  // Unique Customers List for filter dropdown
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      const custName = getCustomerName(s.po_no);
      if (custName) set.add(custName);
    });
    return Array.from(set);
  }, [shipments, purchaseOrders, customers]);

  // Unique Destination Countries List for filter dropdown
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      const country = s.destination_country;
      if (country) set.add(country);
    });
    return Array.from(set);
  }, [shipments]);


  // 4. Map Destinations Calculation (Volume Tonnages and Coordinates)
  const mapDestinations = useMemo(() => {
    const volumeMap: Record<string, number> = {};
    const valueMap: Record<string, number> = {};
    
    shipments.forEach(s => {
      const country = s.destination_country || "United States";
      const vol = s.weight_mt || s.quantity_tons || 0;
      const val = s.contract_value || 0;
      volumeMap[country] = (volumeMap[country] || 0) + vol;
      valueMap[country] = (valueMap[country] || 0) + val;
    });

    const maxVolume = Math.max(...Object.values(volumeMap), 1);

    // Precise relative coordinates in a 1000 x 500 projection viewBox
    const coordinates: Record<string, { x: number; y: number }> = {
      "United States": { x: 230, y: 175 },
      "Germany": { x: 500, y: 135 },
      "Singapore": { x: 780, y: 310 },
      "China": { x: 760, y: 195 },
      "Japan": { x: 865, y: 170 }
    };

    return Object.entries(volumeMap).map(([name, volume]) => {
      const coords = coordinates[name] || { x: 500, y: 250 };
      const value = valueMap[name] || 0;
      const ratio = volume / maxVolume;
      // Pulse scale and radius proportional to active volume
      const radius = 6 + ratio * 14;
      const pulseScale = 1.2 + ratio * 1.6;
      
      return {
        name,
        volume,
        value,
        x: coords.x,
        y: coords.y,
        radius,
        pulseScale,
        percentage: ratio * 100
      };
    });
  }, [shipments]);

  // 5. Selected Country Portfolio Breakdown for interactive drill-down popup
  const selectedCountryPortfolio = useMemo(() => {
    if (!selectedCountry) return [];

    // Filter shipments going to the selected country
    const countryShipments = shipments.filter(s => {
      const country = s.destination_country || "United States";
      return country.toLowerCase() === selectedCountry.toLowerCase();
    });

    const productMap: Record<string, { volume: number; value: number; latestDiNo: string; latestUnitPrice: number; isTrendingUp: boolean; variancePercent: string }> = {};
    let totalVolume = 0;

    countryShipments.forEach(s => {
      const prod = s.product_info || "Tapioca Flour Extra";
      const vol = s.weight_mt || s.quantity_tons || 0;
      const val = s.contract_value || 0;
      
      if (!productMap[prod]) {
        // Preset baselines for realistic variance calculation
        const baselinePrices: Record<string, number> = {
          "Tapioca Flour Extra": 620,
          "Sweet Potato Powder": 640,
          "Tapioca Pearls Premium": 700,
          "Pumpkin Flour Organic": 750
        };
        const baseline = baselinePrices[prod] || 600;
        const unitPrice = vol > 0 ? val / vol : 0;
        const isUp = unitPrice >= baseline;
        const variance = Math.abs(((unitPrice - baseline) / baseline) * 100).toFixed(1);

        productMap[prod] = { 
          volume: 0, 
          value: 0,
          latestDiNo: s.di_no,
          latestUnitPrice: unitPrice,
          isTrendingUp: isUp,
          variancePercent: variance
        };
      }
      productMap[prod].volume += vol;
      productMap[prod].value += val;
      totalVolume += vol;
    });

    return Object.entries(productMap).map(([name, data]) => ({
      name,
      volume: data.volume,
      value: data.value,
      percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
      latestDiNo: data.latestDiNo,
      latestUnitPrice: data.latestUnitPrice,
      isTrendingUp: data.isTrendingUp,
      variancePercent: data.variancePercent
    })).sort((a, b) => b.volume - a.volume);
  }, [selectedCountry, shipments]);



  return (
    <div className="min-h-screen text-slate-100 font-sans transition-all duration-300">
      
      {/* Header Module */}
      <header className="glass-panel sticky top-0 z-50 border-b border-slate-900/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5 select-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-500/10">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                WCAT <span className="text-cyan-400 font-light">OPERATIONS MANAGER</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono mt-1">ROLE: EXECUTIVE DECISION PORTAL</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Toggle Theme Mode"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-900">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-300">{profile?.company_name || "Enterprise Operations"}</div>
                <div className="text-[10px] text-slate-500 font-mono">{profile?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-red-950/20 hover:bg-red-900/40 border border-red-500/10 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                title="Secure Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* ======================================================== */}
        {/* SECTION 1: EXECUTIVE KPI METRICS (VOLUME VS REVENUE)     */}
        {/* ======================================================== */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Card 1: Total Volume */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-slate-800 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total quantity volume</span>
              <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/10 text-cyan-400">
                <Package className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-cyan-400 transition-all">
                {stats.totalVolume.toFixed(2)} <span className="text-xs font-normal text-slate-500">MT</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Active commercial load tonnage
              </p>
            </div>
          </div>

          {/* Card 2: Total Revenue Value */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-slate-800 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total pipeline value</span>
              <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/10 text-emerald-400">
                <Coins className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-emerald-400 transition-all">
                ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Total contract value exposure
              </p>
            </div>
          </div>

          {/* Card 3: Watchlist Stuck Shipments */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-slate-800 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Stuck watchlist</span>
              <div className="p-2 rounded-xl bg-red-950/30 border border-red-500/10 text-red-400">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-red-400 transition-all">
                {stats.watchlistCount} <span className="text-xs font-normal text-slate-500">DIs</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" /> Pending physical logistics resolution
              </p>
            </div>
          </div>

          {/* Card 4: Average Shipment Exposure */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-slate-800 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Avg shipment value</span>
              <div className="p-2 rounded-xl bg-purple-950/30 border border-purple-500/10 text-purple-400">
                <Globe className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-purple-400 transition-all">
                ${stats.avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Normalized value allocation
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 1.5: EXECUTIVE ANALYTICS & COMMERCIAL CHARTS    */}
        {/* ======================================================== */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900/60 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-cyan-400" /> Executive Analytics & Commercial Control Tower
              </h3>
              <p className="text-xs text-slate-400 mt-1">Real-time dynamic export intelligence, volumetric allocations, price indices, and top revenue drivers.</p>
            </div>
          </div>

          {/* Slicers row */}
          <div className="flex flex-wrap items-center gap-6 text-xs border-b border-slate-900/50 pb-4 select-none">
            {/* Month Slicer */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Month:</span>
              <div className="flex flex-wrap gap-1.5">
                {["all", "Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMonthSlicer(m)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all cursor-pointer border ${
                      activeMonthSlicer === m
                        ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-300 shadow-sm"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {m === "all" ? "All" : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Shipment Type Slicer */}
            <div className="flex items-center gap-2 pl-4 border-l border-slate-900/60">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Type:</span>
              <div className="flex gap-1.5">
                {["all", "Container", "Bulk", "Domestic"].map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTypeSlicer(t)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all cursor-pointer border ${
                      activeTypeSlicer === t
                        ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-300 shadow-sm"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "all" ? "All" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Slicer */}
            <div className="flex items-center gap-2 pl-4 border-l border-slate-900/60">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Product:</span>
              <select
                value={activeProductSlicer}
                onChange={(e) => setActiveProductSlicer(e.target.value)}
                className="px-2 py-0.5 bg-slate-900/40 border border-slate-800 rounded-md text-[10px] font-bold text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="all">All Products</option>
                {uniqueProducts.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Monthly Export Volume */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-all duration-300 flex flex-col justify-between min-h-[380px]">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4 text-[#1A2B49] dark:text-slate-400">Monthly Export Volume (MT)</h4>
                <div className="w-full h-[300px] relative border-b border-slate-200/40 dark:border-slate-900/60 pt-4 pb-6 px-1 flex items-end">
                  {(() => {
                    const topRoundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
                      const radius = Math.min(r, h, w / 2);
                      if (radius <= 0) {
                        return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
                      }
                      return `M ${x} ${y + radius} 
                              A ${radius} ${radius} 0 0 1 ${x + radius} ${y} 
                              L ${x + w - radius} ${y} 
                              A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} 
                              L ${x + w} ${y + h} 
                              L ${x} ${y + h} Z`;
                    };

                    const maxVol = Math.max(
                      ...monthlyVolumes.map(mv => Math.max(mv.container, mv.bulk, mv.domestic)),
                      1
                    );

                    return (
                      <div className="w-full h-full relative">
                        {/* Hover Tooltip Overlay */}
                        {hoveredMonthIdx !== null && (
                          <div 
                            className="absolute bg-slate-950/95 dark:bg-slate-900/95 border border-slate-850 dark:border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur z-20 pointer-events-none select-none transition-all duration-150 ease-out"
                            style={{
                              left: `${(hoveredMonthIdx * (100 / 12)) + (100 / 24)}%`,
                              top: '0px',
                              transform: hoveredMonthIdx > 7 ? 'translateX(-105%)' : hoveredMonthIdx < 4 ? 'translateX(5%)' : 'translateX(-50%)',
                            }}
                          >
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-mono mb-2">
                              {monthlyVolumes[hoveredMonthIdx].month} Volume Dossier
                            </div>
                            <div className="space-y-1.5 text-[11px] font-mono">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                  Container:
                                </span>
                                <span className="font-extrabold text-white">{monthlyVolumes[hoveredMonthIdx].container.toFixed(1)} MT</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Bulk Vessel:
                                </span>
                                <span className="font-extrabold text-white">{monthlyVolumes[hoveredMonthIdx].bulk.toFixed(1)} MT</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Domestic:
                                </span>
                                <span className="font-extrabold text-white">{monthlyVolumes[hoveredMonthIdx].domestic.toFixed(1)} MT</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          {/* Elegant horizontal background grid lines */}
                          <line x1="0" y1="10" x2="100" y2="10" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="30" x2="100" y2="30" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="50" x2="100" y2="50" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="70" x2="100" y2="70" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="90" x2="100" y2="90" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />

                          {/* Render Grouped Side-by-Side Bars for Shipment Types */}
                          {monthlyVolumes.map((m, idx) => {
                            const colWidth = 100 / 12;
                            const xStart = idx * colWidth;
                            
                            // Group dimensions (Symmetric Centering)
                            const w = 1.3; // Sleek professional width for 3 bars
                            const g = 0.2; // Spacing gap
                            const totalGroupWidth = 3 * w + 2 * g;
                            const xGroupStart = xStart + (colWidth - totalGroupWidth) / 2;
                            
                            const getBarYAndHeight = (val: number) => {
                              const y = 90 - (val / maxVol) * 80;
                              const height = 90 - y;
                              return { y, height };
                            };

                            const cData = getBarYAndHeight(m.container);
                            const bData = getBarYAndHeight(m.bulk);
                            const dData = getBarYAndHeight(m.domestic);

                            return (
                              <g key={idx}>
                                {/* Container (Cyan #06b6d4) */}
                                {cData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart, cData.y, w, cData.height, 0.4)} 
                                    fill="#06b6d4" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                                
                                {/* Bulk Vessel (Emerald Green #10b981) */}
                                {bData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart + w + g, bData.y, w, bData.height, 0.4)} 
                                    fill="#10b981" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                                
                                {/* Domestic (Amber/Gold #f59e0b) */}
                                {dData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart + 2 * (w + g), dData.y, w, dData.height, 0.4)} 
                                    fill="#f59e0b" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                              </g>
                            );
                          })}

                          {/* Hover Guideline */}
                          {hoveredMonthIdx !== null && (
                            <line 
                              x1={(hoveredMonthIdx * (100 / 12)) + (100 / 24)} 
                              y1="0" 
                              x2={(hoveredMonthIdx * (100 / 12)) + (100 / 24)} 
                              y2="100" 
                              className="stroke-slate-400/40 dark:stroke-slate-800/40" 
                              strokeDasharray="2" 
                              strokeWidth="0.8" 
                            />
                          )}

                          {/* Invisible Trigger rects for hover interaction (12 columns) */}
                          {monthlyVolumes.map((_, idx) => {
                            const colWidth = 100 / 12;
                            const x = idx * colWidth;
                            return (
                              <rect
                                key={idx}
                                x={x}
                                y="0"
                                width={colWidth}
                                height="100"
                                fill="transparent"
                                className="cursor-pointer pointer-events-auto"
                                onMouseEnter={() => setHoveredMonthIdx(idx)}
                                onMouseLeave={() => setHoveredMonthIdx(null)}
                              />
                            );
                          })}
                        </svg>

                        {/* X-Axis Labels (Symmetrically Centered Under Columns) */}
                        <div className="absolute top-[102%] w-full flex text-slate-500 text-[9px] font-bold font-mono select-none">
                          {monthlyVolumes.map((item, idx) => (
                            <span 
                              key={idx} 
                              className="flex-1 text-center tracking-wider uppercase text-[#1A2B49] dark:text-slate-500 text-[8px] sm:text-[9px]"
                            >
                              {item.month}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Legend Below Chart */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-200/40 dark:border-slate-900/40 text-[9px] sm:text-[10px] font-bold select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Container</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Bulk Vessel</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Domestic</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Shipment Type Share */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-all duration-300 flex flex-col justify-between min-h-[380px]">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4 text-[#1A2B49] dark:text-slate-400">Shipment Type Share (MT)</h4>
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-48 py-2">
                  <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(15, 23, 42, 0.4)" strokeWidth="3" />
                      {(() => {
                        let cumulativePercentage = 0;
                        const colors = ["stroke-cyan-400", "stroke-emerald-400", "stroke-amber-400"];
                        return shipmentTypeShare.map((item, idx) => {
                          const strokeDash = `${item.percentage} ${100 - item.percentage}`;
                          const strokeOffset = 100 - cumulativePercentage;
                          cumulativePercentage += item.percentage;
                          return (
                            <circle
                              key={idx}
                              cx="18"
                              cy="18"
                              r="15.915"
                              fill="none"
                              className={`transition-all duration-500 ${colors[idx % colors.length]}`}
                              strokeWidth="3"
                              strokeDasharray={strokeDash}
                              strokeDashoffset={strokeOffset}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute text-center select-none pointer-events-none">
                      <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Total</span>
                      <span className="text-sm font-extrabold text-white leading-none">
                        {shipmentTypeShare.reduce((sum, item) => sum + item.value, 0).toFixed(0)} <span className="text-[9px] font-normal text-slate-500">MT</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const bulletColors = ["bg-cyan-400", "bg-emerald-400", "bg-amber-400"];
                      const textColors = ["text-cyan-300", "text-emerald-300", "text-amber-300"];
                      return shipmentTypeShare.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${bulletColors[idx % bulletColors.length]}`}></span>
                          <div className="text-[11px] leading-tight select-none">
                            <span className="font-semibold text-slate-300 block">{item.name}</span>
                            <span className={`text-[10px] font-mono font-bold ${textColors[idx % textColors.length]}`}>
                              {item.percentage}% ({item.value.toFixed(0)} MT)
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 3: Monthly Price Index */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-all duration-300 flex flex-col justify-between min-h-[380px]">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4 text-[#1A2B49] dark:text-slate-400">Monthly Price Index ($/MT)</h4>
                <div className="w-full h-[300px] relative border-b border-slate-200/40 dark:border-slate-900/60 pt-4 pb-6 px-1 flex items-end">
                  {(() => {
                    const topRoundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
                      const radius = Math.min(r, h, w / 2);
                      if (radius <= 0) {
                        return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
                      }
                      return `M ${x} ${y + radius} 
                              A ${radius} ${radius} 0 0 1 ${x + radius} ${y} 
                              L ${x + w - radius} ${y} 
                              A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} 
                              L ${x + w} ${y + h} 
                              L ${x} ${y + h} Z`;
                    };

                    return (
                      <div className="w-full h-full relative">
                        {/* Hover Tooltip Overlay */}
                        {hoveredMonthIdx !== null && (
                          <div 
                            className="absolute bg-slate-950/95 dark:bg-slate-900/95 border border-slate-850 dark:border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur z-20 pointer-events-none select-none transition-all duration-150 ease-out"
                            style={{
                              left: `${(hoveredMonthIdx * (100 / 12)) + (100 / 24)}%`,
                              top: '0px',
                              transform: hoveredMonthIdx > 7 ? 'translateX(-105%)' : hoveredMonthIdx < 4 ? 'translateX(5%)' : 'translateX(-50%)',
                            }}
                          >
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest font-mono mb-2">
                              {monthlyPriceIndex[hoveredMonthIdx].month} Price Dossier
                            </div>
                            <div className="space-y-1.5 text-[11px] font-mono">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Tapioca:
                                </span>
                                <span className="font-extrabold text-white">${monthlyPriceIndex[hoveredMonthIdx].tapioca}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  Sweet Potato:
                                </span>
                                <span className="font-extrabold text-white">${monthlyPriceIndex[hoveredMonthIdx].sweetPotato}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                  Pumpkin:
                                </span>
                                <span className="font-extrabold text-white">${monthlyPriceIndex[hoveredMonthIdx].pumpkin}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Pearls:
                                </span>
                                <span className="font-extrabold text-white">${monthlyPriceIndex[hoveredMonthIdx].pearls}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          {/* Elegant, ultra-low opacity horizontal background grid lines */}
                          <line x1="0" y1="10" x2="100" y2="10" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="30" x2="100" y2="30" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="50" x2="100" y2="50" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="70" x2="100" y2="70" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />
                          <line x1="0" y1="90" x2="100" y2="90" className="stroke-slate-800 opacity-[0.12] dark:opacity-[0.15]" strokeWidth="0.5" />

                          {/* Render Grouped Side-by-Side Bars */}
                          {monthlyPriceIndex.map((m, idx) => {
                            const colWidth = 100 / 12;
                            const xStart = idx * colWidth;
                            
                            // Group dimensions (Symmetric Centering)
                            const w = 1.2; // Sleek professional width
                            const g = 0.2; // Gap between bars
                            const totalGroupWidth = 4 * w + 3 * g;
                            const xGroupStart = xStart + (colWidth - totalGroupWidth) / 2;
                            
                            const getBarYAndHeight = (val: number) => {
                              // If value is 0 (unrecorded/future), height must be 0
                              const y = 90 - (val / 1000) * 80;
                              const height = 90 - y;
                              return { y, height };
                            };

                            const tData = getBarYAndHeight(m.tapioca);
                            const sData = getBarYAndHeight(m.sweetPotato);
                            const pData = getBarYAndHeight(m.pumpkin);
                            const peData = getBarYAndHeight(m.pearls);

                            return (
                              <g key={idx}>
                                {/* Tapioca Flour (Vibrant Emerald Green #10b981) */}
                                {tData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart, tData.y, w, tData.height, 0.4)} 
                                    fill="#10b981" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                                
                                {/* Sweet Potato Powder (Sleek Blue #3b82f6) */}
                                {sData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart + w + g, sData.y, w, sData.height, 0.4)} 
                                    fill="#3b82f6" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                                
                                {/* Pumpkin Flour Organic (Deep Purple #a855f7) */}
                                {pData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart + 2 * (w + g), pData.y, w, pData.height, 0.4)} 
                                    fill="#a855f7" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                                
                                {/* Amber/Other Products (Premium Gold/Orange #f59e0b) */}
                                {peData.height > 0 && (
                                  <path 
                                    d={topRoundedRectPath(xGroupStart + 3 * (w + g), peData.y, w, peData.height, 0.4)} 
                                    fill="#f59e0b" 
                                    className="transition-all duration-300 hover:opacity-80"
                                  />
                                )}
                              </g>
                            );
                          })}

                          {/* Hover Guideline */}
                          {hoveredMonthIdx !== null && (
                            <line 
                              x1={(hoveredMonthIdx * (100 / 12)) + (100 / 24)} 
                              y1="0" 
                              x2={(hoveredMonthIdx * (100 / 12)) + (100 / 24)} 
                              y2="100" 
                              className="stroke-slate-400/40 dark:stroke-slate-800/40" 
                              strokeDasharray="2" 
                              strokeWidth="0.8" 
                            />
                          )}

                          {/* Invisible Trigger rects for hover interaction (12 columns) */}
                          {monthlyPriceIndex.map((_, idx) => {
                            const colWidth = 100 / 12;
                            const x = idx * colWidth;
                            return (
                              <rect
                                key={idx}
                                x={x}
                                y="0"
                                width={colWidth}
                                height="100"
                                fill="transparent"
                                className="cursor-pointer pointer-events-auto"
                                onMouseEnter={() => setHoveredMonthIdx(idx)}
                                onMouseLeave={() => setHoveredMonthIdx(null)}
                              />
                            );
                          })}
                        </svg>

                        {/* X-Axis Labels (Symmetrically Centered Under Columns) */}
                        <div className="absolute top-[102%] w-full flex text-slate-500 text-[9px] font-bold font-mono select-none">
                          {monthlyPriceIndex.map((item, idx) => (
                            <span 
                              key={idx} 
                              className="flex-1 text-center tracking-wider uppercase text-[#1A2B49] dark:text-slate-500 text-[8px] sm:text-[9px]"
                            >
                              {item.month}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Active Month Name Indicator */}
                <div className="flex justify-center mt-4 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase font-mono h-4 select-none">
                  {hoveredMonthIdx !== null ? (
                    <span className="text-emerald-500 dark:text-emerald-400 transition-all duration-200">
                      Inspection Horizon: {
                        ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][hoveredMonthIdx]
                      } 2026
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 opacity-70 transition-all duration-200">
                      Hover columns for active monthly dossier
                    </span>
                  )}
                </div>

                {/* Legend Below Chart */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-200/40 dark:border-slate-900/40 text-[9px] sm:text-[10px] font-bold select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Tapioca Flour Extra</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Sweet Potato Powder</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Pumpkin Flour Organic</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0"></span>
                    <span className="text-[#1A2B49] dark:text-slate-400 font-mono">Tapioca Pearls Premium</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 4: Top 5 Products by Value */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-all duration-300 flex flex-col justify-between min-h-[300px]">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4">Top 5 Products by Value ($)</h4>
                <div className="space-y-4 h-48 py-2 overflow-y-auto pr-1 flex flex-col justify-around">
                  {(() => {
                    const maxVal = Math.max(...topProducts.map(tp => tp.value), 1);
                    return topProducts.map((item, idx) => {
                      const widthPct = (item.value / maxVal) * 100;
                      const barColors = [
                        "from-blue-600 to-cyan-500", 
                        "from-indigo-600 to-blue-500", 
                        "from-emerald-600 to-cyan-500",
                        "from-purple-600 to-indigo-500",
                        "from-amber-600 to-yellow-500"
                      ];
                      return (
                        <div key={idx} className="space-y-1.5 group select-none">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-350">
                            <span className="truncate max-w-[200px] text-slate-350 font-bold group-hover:text-cyan-400 transition-all">{item.name}</span>
                            <span className="font-extrabold text-white font-mono">${item.value.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden bg-slate-900/50 border border-slate-900">
                            <div 
                              className={`h-full rounded-full bg-gradient-to-r ${barColors[idx % barColors.length]} transition-all duration-500`}
                              style={{ width: `${widthPct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: COMMERCIAL BOTTLENECK MONITOR (WATCHLIST)     */}
        {/* ======================================================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-cyan-400" /> Commercial Bottleneck Monitor
              </h2>
              <p className="text-xs text-slate-400 mt-1">Real-time watchdog tracking logistics bottlenecks and value exposure.</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search DI, PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
                >
                  <option value="all">All Products</option>
                  {uniqueProducts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Customer Filter */}
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedCustomerFilter}
                  onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
                >
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Country/Destination Filter */}
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
                >
                  <option value="all">All Destinations</option>
                  {uniqueCountries.map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-4 px-5">DI NO.</th>
                    <th className="py-4 px-3">CUSTOMER & PIC</th>
                    <th className="py-4 px-3">PRODUCT</th>
                    <th className="py-4 px-3">VOLUME (MT)</th>
                    <th className="py-4 px-3">UNIT PRICE & VALUE</th>
                    <th className="py-4 px-3">SLA STATUS</th>
                    <th className="py-4 px-3">NEXT ACTION REQUIRED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs">
                  {visibleShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                        No active commercial bottlenecks or watchlist items detected.
                      </td>
                    </tr>
                  ) : (
                    visibleShipments.map(ship => {
                      const volume = ship.weight_mt || ship.quantity_tons || 0;
                      const value = ship.contract_value || 0;
                      const prod = ship.product_info || "Tapioca Flour Extra";
                      
                      // Calculate average unit price
                      const unitPrice = volume > 0 ? value / volume : 0;

                      // Customer Name and PIC Assignment
                      const customerName = getCustomerName(ship.po_no);
                      let internalPic = "Ae"; // Default PIC
                      if (ship.po_no.startsWith("PO-2603")) {
                        internalPic = "Depper";
                      } else if (ship.po_no.startsWith("PO-2604")) {
                        internalPic = "Pai";
                      }

                      // SLA Status determination
                      const getSlaStatus = (item: Shipment) => {
                        if (!item.etd_date) return "Within SLA";
                        const etdParts = item.etd_date.split("-").map(Number);
                        const etd = new Date(etdParts[0], etdParts[1] - 1, etdParts[2]);
                        const today = new Date(2026, 4, 25); // May 25, 2026 reference date
                        const diffTime = today.getTime() - etd.getTime();
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays > 0) {
                          return `Over SLA by ${diffDays} Days`;
                        } else if (diffDays === 0) {
                          return "SLA Warning (Today)";
                        } else {
                          return "Within SLA";
                        }
                      };

                      const slaStatus = getSlaStatus(ship);
                      const isDelayed = slaStatus.startsWith("Over SLA") || slaStatus.includes("Warning");

                      // Next Action Required message
                      const getNextAction = (item: Shipment, pic: string) => {
                        if (item.di_no === "DI-2601-A3") {
                          return "Awaiting Fixture Note confirmation from vessel agent";
                        }
                        if (item.di_no === "DI-2601-A2") {
                          return "Ae reviewing customs declaration draft";
                        }
                        if (item.di_no === "DI-2601-A1") {
                          return "Ae submitting production release request to milling plant";
                        }
                        
                        switch (item.status) {
                          case "pending_production":
                            return `${pic} coordinating factory queue prioritization`;
                          case "pending_packaging":
                            return "Awaiting quality control release of packaged cargo";
                          case "awaiting_loading":
                            return `${pic} coordinating container spotting with yard agent`;
                          case "loaded_into_container":
                            return "Awaiting terminal gate-in scan and customs check";
                          case "awaiting_bl_confirmation":
                            return `${pic} reviewing draft B/L and shipping instruction`;
                          case "awaiting_all_docs":
                            return "Compile invoice & COO pack for buyer review";
                          case "etd":
                            return "Monitor vessel departure and load confirmation";
                          default:
                            return "Awaiting regular operational schedule update";
                        }
                      };

                      const nextAction = getNextAction(ship, internalPic);

                      return (
                        <tr key={ship.di_no} className="hover:bg-slate-900/10 transition-all">
                          {/* DI NO. */}
                          <td className="py-3.5 px-5 font-bold text-white leading-none">{ship.di_no}</td>
                          
                          {/* CUSTOMER & PIC */}
                          <td className="py-3.5 px-3 leading-tight">
                            <div className="font-semibold text-slate-300">{customerName}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-mono">PIC: {internalPic}</div>
                          </td>
                          
                          {/* PRODUCT */}
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded bg-slate-100 text-[#1A2B49] dark:bg-slate-950 dark:border dark:border-slate-900 dark:text-cyan-300 text-[10px] font-bold tracking-wide inline-block leading-none">
                              {prod}
                            </span>
                          </td>
                          
                          {/* VOLUME (MT) */}
                          <td className="py-3.5 px-3 font-semibold text-slate-300 leading-none">{volume.toFixed(2)} MT</td>
                          
                          {/* UNIT PRICE & VALUE */}
                          <td className="py-3.5 px-3 leading-tight">
                            <div className="font-bold text-[#1A2B49] dark:text-white">${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / MT</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5 font-medium">(Total: ${value.toLocaleString()})</div>
                          </td>
                          
                          {/* SLA STATUS */}
                          <td className="py-3.5 px-3 leading-none">
                            {isDelayed ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-950/45 border border-red-500/20 text-[9px] font-extrabold text-red-400 inline-block active-pulse">
                                🚨 {slaStatus.toUpperCase()}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-500/20 text-[9px] font-extrabold text-emerald-400 inline-block">
                                ⏳ {slaStatus.toUpperCase()}
                              </span>
                            )}
                          </td>
                          
                          {/* NEXT ACTION REQUIRED */}
                          <td className="py-3.5 px-3 leading-tight max-w-[220px]">
                            <p className="text-slate-300 font-medium truncate" title={nextAction}>
                              {nextAction}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Actionable Overflow Terminal */}
            {watchlistShipments.length > 5 && (
              <div className="border-t border-slate-900/60 bg-slate-950/10 py-3.5 px-5 flex items-center justify-center">
                <button
                  onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
                  className="flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer bg-transparent border-0 outline-none hover:underline"
                >
                  {isLedgerExpanded ? "Collapse Operational Ledger" : "Access Full Operational Ledger & Logistics Logs"}
                  {isLedgerExpanded ? <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" /> : <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: INTERACTIVE GLOBAL SHIPMENTS WORLD MAP         */}
        {/* ======================================================== */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" /> Interactive Global Shipments Map
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">Real-time tonnage distribution and commercial exposure overlay (Click for details)</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 text-[10px] font-semibold text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Destinations</span>
              </div>
              <div className="text-slate-500">
                Dot Size ∝ Tonnage Volume (MT)
              </div>
            </div>
          </div>

          <div className="relative w-full overflow-hidden bg-slate-950/20 border border-slate-900/60 rounded-2xl flex items-center justify-center p-2 sm:p-4">
            <svg 
              viewBox="0 0 1000 500" 
              className="w-full h-auto max-h-[480px] select-none text-slate-800 dark:text-slate-200 transition-colors duration-300"
            >
              {/* Oceanic coordinate dots grid pattern */}
              <defs>
                <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" className="fill-slate-800/20 dark:fill-slate-700/10" />
                </pattern>
              </defs>
              <rect width="1000" height="500" fill="url(#gridPattern)" />

              {/* Vector outlines of main continents - Detailed political cartography */}
              {/* Eurasia (Europe + Asia) */}
              <path 
                d="M 430,200 C 430,190 420,180 415,160 C 410,140 405,120 420,120 C 435,120 445,100 450,110 C 455,120 470,110 480,105 C 490,100 500,90 510,95 C 520,100 535,80 545,85 C 555,90 570,75 580,75 C 590,75 600,60 615,65 C 630,70 650,55 670,60 C 690,65 710,50 730,55 C 750,60 770,55 790,60 C 810,65 830,60 850,70 C 870,80 890,75 910,80 C 930,85 950,90 960,110 C 970,130 955,145 945,150 C 935,155 920,170 910,185 C 900,200 880,185 870,185 C 860,185 850,210 840,225 C 830,240 810,240 800,250 C 790,260 795,280 785,290 C 775,300 770,320 755,320 C 740,320 735,290 735,260 C 735,230 705,250 690,260 C 675,270 650,260 640,265 C 630,270 615,255 600,250 C 585,245 570,240 555,240 C 540,240 515,230 485,220 C 455,210 440,210 430,200 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              
              {/* North America */}
              <path 
                d="M 60,80 C 75,75 90,70 110,60 C 130,50 160,50 180,60 C 200,70 230,55 250,60 C 270,65 290,80 300,90 C 310,100 325,120 320,130 C 315,140 295,160 290,170 C 285,180 305,200 310,210 C 315,220 290,230 280,240 C 270,250 260,230 250,220 C 240,210 230,245 225,270 C 220,295 215,270 215,270 C 215,270 210,230 210,230 C 210,230 170,215 170,215 C 170,215 140,225 120,220 C 100,215 100,180 100,160 C 100,140 75,165 60,150 C 45,135 45,95 60,80 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              
              {/* South America */}
              <path 
                d="M 225,275 C 235,275 250,280 260,285 C 270,290 285,300 290,310 C 295,320 315,340 320,350 C 325,360 305,400 300,430 C 295,460 285,475 280,480 C 275,485 265,480 265,480 C 265,480 250,440 250,400 C 250,360 230,345 220,330 C 210,315 215,300 215,300 C 215,300 215,275 225,275 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              
              {/* Africa */}
              <path 
                d="M 440,250 C 455,240 470,230 485,220 C 500,210 520,215 530,220 C 540,225 550,235 555,245 C 560,255 580,270 600,290 C 620,310 600,335 585,350 C 570,365 575,380 570,390 C 565,400 550,420 545,430 C 540,440 535,430 535,430 C 535,430 525,400 515,360 C 505,320 495,315 480,310 C 465,305 450,300 440,295 C 430,290 425,260 440,250 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              
              {/* Australia */}
              <path 
                d="M 810,380 C 830,375 850,365 870,370 C 890,375 905,385 910,390 C 915,395 900,420 890,440 C 880,460 850,445 830,430 C 810,415 790,385 810,380 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              
              {/* Greenland */}
              <path 
                d="M 330,50 C 350,40 370,35 390,30 C 410,25 415,60 410,75 C 405,90 380,85 350,90 C 320,95 310,60 330,50 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />

              {/* Major Islands chains for high cartographic fidelity */}
              {/* Japan Archipelago */}
              <path 
                d="M 870,145 C 872,140 878,142 880,148 C 882,154 880,165 875,170 C 870,175 865,185 862,180 C 859,175 865,160 868,155 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              {/* Great Britain & Ireland */}
              <path 
                d="M 445,115 C 448,110 452,108 455,112 C 458,116 455,124 452,126 C 449,128 442,120 445,115 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              {/* Madagascar */}
              <path 
                d="M 590,380 C 593,375 598,385 600,400 C 602,415 598,418 595,410 C 592,402 587,385 590,380 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              {/* Iceland */}
              <path 
                d="M 425,75 C 430,72 435,74 433,78 C 431,82 423,84 421,80 C 419,76 420,78 425,75 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              {/* Indonesia & Malaysia (Archipelago) */}
              <path 
                d="M 760,295 C 770,290 780,295 785,305 C 790,315 782,325 770,320 C 758,315 750,300 760,295 Z M 800,310 C 810,305 820,310 825,320 C 830,330 820,340 805,335 C 790,330 790,315 800,310 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />
              {/* New Zealand (North & South Islands) */}
              <path 
                d="M 915,445 C 918,440 922,442 925,448 C 928,454 924,460 918,455 C 912,450 912,450 915,445 Z" 
                className="fill-slate-900/40 dark:fill-slate-800/20 stroke-slate-800/50 dark:stroke-slate-900/50 transition-colors duration-300" 
                strokeWidth="1" 
              />

              {/* Dynamic pulsing dots and visual labels */}
              {mapDestinations.map((dest) => (
                <g 
                  key={dest.name} 
                  className="cursor-pointer group"
                  onClick={() => setSelectedCountry(dest.name)}
                >
                  {/* Glowing pulsing halo 1 */}
                  <circle
                    cx={dest.x}
                    cy={dest.y}
                    r={dest.radius * 2}
                    className="fill-emerald-500/10 stroke-emerald-500/20 animate-pulse group-hover:scale-110 transition-transform duration-300"
                  />
                  {/* Radial ping ring */}
                  <circle
                    cx={dest.x}
                    cy={dest.y}
                    r={dest.radius}
                    className="fill-emerald-500/20 stroke-emerald-400/45 animate-ping"
                    style={{
                      transformOrigin: `${dest.x}px ${dest.y}px`,
                      animationDuration: `${3 / dest.pulseScale}s`
                    }}
                  />
                  {/* Core dot anchor */}
                  <circle
                    cx={dest.x}
                    cy={dest.y}
                    r={dest.radius * 0.55}
                    className="fill-emerald-400 stroke-emerald-300 stroke-[1.5] shadow-lg shadow-emerald-500/35 group-hover:fill-emerald-300 transition-colors"
                  />
                  {/* Clean text backdrop box for high readability */}
                  <rect
                    x={dest.x + dest.radius + 4}
                    y={dest.y - 12}
                    width={dest.name.length * 7 + 10}
                    height={16}
                    rx={4}
                    className="fill-slate-950/70 dark:fill-slate-900/80 stroke-slate-900/40 dark:stroke-slate-800/40 group-hover:fill-slate-900/90 dark:group-hover:fill-slate-800/90 transition-colors"
                    strokeWidth="0.5"
                  />
                  {/* Country Name text */}
                  <text
                    x={dest.x + dest.radius + 9}
                    y={dest.y}
                    className="fill-white font-mono font-extrabold text-[10px] tracking-wider pointer-events-none select-none"
                  >
                    {dest.name.toUpperCase()}
                  </text>
                  {/* Metric Subtitle text */}
                  <text
                    x={dest.x + dest.radius + 6}
                    y={dest.y + 18}
                    className="fill-slate-200 dark:fill-slate-400 font-sans font-bold text-[9px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] pointer-events-none select-none"
                  >
                    {dest.volume.toFixed(1)} MT / ${dest.value.toLocaleString()}
                  </text>
                </g>
              ))}
            </svg>

            {/* Drill-down popover card rendered inside map panel bounds */}
            {selectedCountry && (
              <div className="absolute inset-0 bg-slate-950/35 dark:bg-slate-950/65 backdrop-blur-[3px] flex items-center justify-center z-40 p-4 transition-all duration-300">
                <div 
                  className="w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl relative transition-all duration-300 
                    bg-white border-slate-200 text-slate-800 
                    dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-200 dark:border-slate-850">
                    <h4 className="text-xs font-mono font-extrabold tracking-wider uppercase flex items-center gap-2 text-[#1A2B49] dark:text-white">
                      <Globe className="w-4 h-4 text-cyan-500" /> {selectedCountry} Export Portfolio
                    </h4>
                    <button 
                      onClick={() => setSelectedCountry(null)}
                      className="p-1 rounded-lg transition-all text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
                      title="Close Portfolio View"
                    >
                      <span className="text-xs font-bold font-mono">✕</span>
                    </button>
                  </div>

                  {/* Portfolio Breakdown Table Layout */}
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {selectedCountryPortfolio.length === 0 ? (
                      <p className="text-xs text-slate-500 font-medium text-center py-6">
                        No active product exports detected for {selectedCountry}.
                      </p>
                    ) : (
                      selectedCountryPortfolio.map((item, idx) => (
                        <div key={idx} className="space-y-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-850 dark:bg-slate-950/30">
                          {/* Product Title Block */}
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <span className="font-extrabold text-[#1A2B49] dark:text-white text-xs">{item.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">[{item.percentage.toFixed(0)}% OF TOTAL]</span>
                          </div>
                          
                          {/* Volume & Value Metrics */}
                          <div className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">
                            Volume: <span className="font-semibold text-slate-900 dark:text-slate-200">{item.volume.toFixed(1)} MT</span> | Total Value: <span className="font-semibold text-slate-900 dark:text-slate-200">${item.value.toLocaleString()}</span>
                          </div>

                          {/* Price Intelligence Tag */}
                          <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[10px] font-bold text-[#1A2B49] dark:text-emerald-400 bg-slate-100 dark:bg-emerald-950/20 border border-slate-250 dark:border-emerald-500/10 px-2.5 py-1 rounded-lg">
                            <span className="truncate">Latest Closed Price: ${item.latestUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / MT (Ref: {item.latestDiNo})</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.isTrendingUp ? (
                                <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400 stroke-[2.5]" />
                              )}
                              <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">({item.isTrendingUp ? "+" : "-"}{item.variancePercent}%)</span>
                            </div>
                          </div>

                          {/* Horizontal relative volume progress bar */}
                          <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850/60 mt-2">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-500 dark:from-emerald-500 dark:to-cyan-400 transition-all duration-500"
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Portfolio Footer Summary */}
                  <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-850 flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-mono select-none">
                    <span>ACTIVE TRACKING LOGISTICS</span>
                    <span>TOTAL: {selectedCountryPortfolio.reduce((sum, i) => sum + i.volume, 0).toFixed(1)} MT</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
