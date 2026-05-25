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
  TrendingDown
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

  // 2. Watchlist Filter Logic
  const watchlistShipments = useMemo(() => {
    return shipments.filter(ship => {
      // Show shipments that are active (not completed/eta)
      if (ship.status === "eta") return false;

      // Product information details
      const prod = ship.product_info || "Tapioca Flour Extra";
      const matchesSearch = 
        ship.di_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.po_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProduct = 
        selectedProductFilter === "all" || 
        prod === selectedProductFilter;

      return matchesSearch && matchesProduct;
    });
  }, [shipments, searchQuery, selectedProductFilter]);

  // Unique Products List for filter dropdown
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      if (s.product_info) set.add(s.product_info);
    });
    return Array.from(set);
  }, [shipments]);

  // 3. Products Distribution (Top Products by Volume)
  const productDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    shipments.forEach(s => {
      const prod = s.product_info || "Tapioca Flour Extra";
      const vol = s.weight_mt || s.quantity_tons || 0;
      map[prod] = (map[prod] || 0) + vol;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .map(([name, volume]) => ({ 
        name, 
        volume, 
        percentage: total > 0 ? (volume / total) * 100 : 0 
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [shipments]);

  // 4. Destination Markets Distribution
  const countryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    shipments.forEach(s => {
      const country = s.destination_country || "United States";
      const value = s.contract_value || 0;
      map[country] = (map[country] || 0) + value;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentage: total > 0 ? (value / total) * 100 : 0 
      }))
      .sort((a, b) => b.value - a.value);
  }, [shipments]);

  // Retrieve customer name for a shipment
  const getCustomerName = (poNo: string) => {
    const po = purchaseOrders.find(p => p.po_no === poNo);
    if (!po) return "Apex Logistics";
    const cust = customers.find(c => c.customer_id === po.customer_id);
    return cust ? cust.customer_name : "Apex Logistics";
  };

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
            </div>
          </div>

          <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-4 px-5">DI NO.</th>
                    <th className="py-4 px-3">CUSTOMER</th>
                    <th className="py-4 px-3">PRODUCT</th>
                    <th className="py-4 px-3">VOLUME (MT)</th>
                    <th className="py-4 px-3">VALUE ($)</th>
                    <th className="py-4 px-3">DESTINATION</th>
                    <th className="py-4 px-3 text-center">ALERT STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs">
                  {watchlistShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                        No commercial alerts or active bottlenecks detected.
                      </td>
                    </tr>
                  ) : (
                    watchlistShipments.map(ship => {
                      const volume = ship.weight_mt || ship.quantity_tons || 0;
                      const value = ship.contract_value || 0;
                      const prod = ship.product_info || "Tapioca Flour Extra";
                      const country = ship.destination_country || "United States";
                      
                      // Derive alert status details
                      const hasHighLoadAlert = volume >= 40 || ship.di_no === "DI-2601-A3";
                      
                      return (
                        <tr key={ship.di_no} className="hover:bg-slate-900/10 transition-all">
                          <td className="py-3.5 px-5 font-bold text-white leading-none">{ship.di_no}</td>
                          <td className="py-3.5 px-3 text-slate-300 font-semibold leading-none">{getCustomerName(ship.po_no)}</td>
                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-900 text-[10px] font-semibold text-cyan-300 leading-none">
                              {prod}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-300 leading-none">{volume.toFixed(2)} MT</td>
                          <td className="py-3.5 px-3 font-bold text-white leading-none">${value.toLocaleString()}</td>
                          <td className="py-3.5 px-3 leading-none">
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                              <span className="text-slate-300 font-medium">{country}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center leading-none">
                            {hasHighLoadAlert ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-950/45 border border-red-500/20 text-[9px] font-extrabold text-red-400 inline-block active-pulse">
                                🚨 10+ LOAD ALERT
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-yellow-950/40 border border-yellow-500/20 text-[9px] font-extrabold text-yellow-400 inline-block">
                                ⏳ AWAITING BL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: MARKET & PRODUCT DISTRIBUTION INSIGHTS       */}
        {/* ======================================================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Top Products Distribution */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2 mb-6">
                <Package className="w-4 h-4 text-cyan-400" /> Top Products by Volume (Tonnage)
              </h3>
              
              <div className="space-y-4">
                {productDistribution.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-semibold">{item.name}</span>
                      <span className="text-slate-400 font-mono font-bold">
                        {item.volume.toFixed(2)} MT <span className="text-[10px] text-slate-500">({item.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-400 transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Top Destination Markets */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2 mb-6">
                <Globe className="w-4 h-4 text-emerald-400" /> Top Destination Markets (Contract Exposure)
              </h3>
              
              <div className="space-y-4">
                {countryDistribution.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-semibold">{item.name}</span>
                      <span className="text-slate-400 font-mono font-bold">
                        ${item.value.toLocaleString()} <span className="text-[10px] text-slate-500">({item.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
