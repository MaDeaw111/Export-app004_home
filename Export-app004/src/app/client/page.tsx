"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  getCurrentUser, 
  getPurchaseOrders, 
  getShipments, 
  updateShipment, 
  logoutUser, 
  PurchaseOrder, 
  Shipment, 
  UserProfile 
} from "@/utils/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  Package, 
  CheckSquare, 
  LogOut, 
  User, 
  ExternalLink,
  Info,
  Ship,
  Anchor,
  MapPin,
  Compass,
  Sun,
  Moon
} from "lucide-react";
// Helper to derive POL & POD based on customer profile (Thai exporter -> global customers)
const getPorts = (companyName: string | undefined) => {
  const pol = "Laem Chabang Port, TH (TH LCH)";
  let pod = "Port of Los Angeles, US (US LAX)";
  
  const name = companyName?.toLowerCase() || "";
  if (name.includes("vortex")) {
    pod = "Port of Hamburg, DE (DE HAM)";
  } else if (name.includes("oceanic") || name.includes("singapore")) {
    pod = "Port of Singapore, SG (SG SIN)";
  }
  
  return { pol, pod };
};

export default function ClientPortal() {
  return (
    <ProtectedRoute allowedRole="customer">
      <ClientPortalContent />
    </ProtectedRoute>
  );
}

function ClientPortalContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});
  const [submittingBL, setSubmittingBL] = useState<Record<string, boolean>>({});
  const [blFeedback, setBlFeedback] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("wcat_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.classList.toggle("light-theme", savedTheme === "light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("wcat_theme", nextTheme);
    document.body.classList.toggle("light-theme", nextTheme === "light");
  };

  // Fetch initial data
  const loadData = async (userEmail: string) => {
    try {
      const fetchedPOs = await getPurchaseOrders(userEmail);
      setPos(fetchedPOs);

      if (fetchedPOs.length > 0) {
        const poNos = fetchedPOs.map(po => po.po_no);
        const fetchedShipments = await getShipments(poNos);
        setShipments(fetchedShipments);
        
        // Expand the first PO by default for rich layout
        setExpandedPOs({ [fetchedPOs[0].po_no]: true });
      }
    } catch (err) {
      console.error("Error loading customer data:", err);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setProfile(user);
      loadData(user.email);
    }
  }, []);

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  const togglePO = (poNo: string) => {
    setExpandedPOs(prev => ({
      ...prev,
      [poNo]: !prev[poNo]
    }));
  };

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle B/L Approvals
  const handleBLAction = async (diNo: string, action: "approve" | "reject") => {
    setSubmittingBL(prev => ({ ...prev, [diNo]: true }));
    try {
      const feedbackText = blFeedback[diNo] || "";
      
      const updates: Partial<Shipment> = {
        bl_approval_status: action === "approve" ? "approved" : "rejected",
        bl_feedback: feedbackText || (action === "approve" ? "Approved by client." : "Revision requested.")
      };

      // If approved, automatically promote shipment status to "awaiting_all_docs"
      if (action === "approve") {
        updates.status = "awaiting_all_docs";
        // Seed a dummy shipping docs link to make it interactive!
        updates.shipping_docs_link = `https://example.com/docs/shipping-docs-${diNo.toLowerCase()}.zip`;
      }

      await updateShipment(diNo, updates);
      showNotification(
        action === "approve" 
          ? `B/L Draft for ${diNo} approved. Delivery status advanced.` 
          : `Amendment request for ${diNo} submitted to logistics.`,
        "success"
      );

      // Reload fresh state
      if (profile) loadData(profile.email);
    } catch (err) {
      showNotification("Failed to update B/L draft. Please try again.", "error");
    } finally {
      setSubmittingBL(prev => ({ ...prev, [diNo]: false }));
    }
  };

  // Calculate statistics
  const totalPOs = pos.length;
  const activeDIs = shipments.filter(s => s.status !== "eta").length;
  const completedDIs = shipments.filter(s => s.status === "eta").length;


  return (
    <div className="min-h-screen pb-16">
      {/* Dynamic Header */}
      <header className="glass-panel border-b border-slate-900 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Package className="w-5 h-5 text-slate-950 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">WCAT Shipment Track</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {profile?.company_name || "Enterprise Client"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 py-1.5 px-3 rounded-full border border-slate-800 text-xs">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300 font-medium">{profile?.email}</span>
            </div>
            
            {/* Dynamic Theme Toggle Switch */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-inner"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin [animation-duration:20s]" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="py-2 px-3 bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-red-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Toast Notification */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl glass-panel border border-blue-500/30 shadow-2xl flex items-center gap-3 animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
            <p className="text-xs text-white font-medium">{notification.message}</p>
          </div>
        )}

        {/* Dashboard Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Purchase Orders</p>
                <h3 className="text-2xl font-bold text-white mt-1">{totalPOs} <span className="text-xs text-slate-500 font-normal">Active Contract(s)</span></h3>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-900/30 border border-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Shipments</p>
                <h3 className="text-2xl font-bold text-white mt-1">{activeDIs} <span className="text-xs text-slate-500 font-normal">In-Transit DIs</span></h3>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-900/30 border border-emerald-500/20 flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Deliveries</p>
                <h3 className="text-2xl font-bold text-white mt-1">{completedDIs} <span className="text-xs text-slate-500 font-normal">At Destination</span></h3>
              </div>
            </div>
          </div>
        </section>

        {/* PO interactive viewer */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-wide">Purchase Order Tracking Workspace</h2>
            <span className="text-xs text-slate-500">Click a PO to expand nested shipments</span>
          </div>

          {pos.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center border border-slate-900">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-white font-semibold">No Orders Found</h3>
              <p className="text-xs text-slate-500 mt-1">There are currently no active tracking purchase orders under this profile.</p>
            </div>
          ) : (
            pos.map(po => {
              const poShipments = shipments.filter(s => s.po_no === po.po_no);
              const isExpanded = !!expandedPOs[po.po_no];
              
              return (
                <div key={po.po_no} className="glass-card rounded-3xl overflow-hidden border border-slate-900">
                  {/* PO Title Ribbon */}
                  <div 
                    onClick={() => togglePO(po.po_no)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/30 transition-all select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">
                        <FileText className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{po.po_no}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-semibold">
                            {po.payment_term}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">PO Date: {po.po_date}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Contract Value</div>
                        <div className="text-base font-bold text-emerald-400 mt-0.5">
                          ${po.total_amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-medium">
                          {poShipments.length} Shipment{poShipments.length !== 1 ? "s" : ""}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400 bg-slate-900/80 p-1 rounded-lg border border-slate-800" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400 bg-slate-900/80 p-1 rounded-lg border border-slate-800" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nested Shipments (DIs) */}
                  {isExpanded && (
                    <div className="border-t border-slate-900 bg-slate-950/20 p-5 space-y-6">
                      {poShipments.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 bg-slate-900/10 rounded-xl">
                          Production split instructions are pending for this order.
                        </div>
                      ) : (
                        poShipments.map(ship => {
                          
                          return (
                            <div 
                              key={ship.di_no} 
                              className="p-5 rounded-2xl bg-slate-900/20 border border-slate-900/60 flex flex-col gap-6 relative"
                            >
                              {/* Shipment Header Details */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">{ship.di_no}</h4>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-900/20 border border-blue-500/20 text-[10px] text-blue-400 font-semibold">
                                      {ship.product_id}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>Quantity: <strong>{Number(ship.quantity_tons).toFixed(3)} Tons</strong></span>
                                    {ship.container_no && <span>Container: <strong>{ship.container_no}</strong></span>}
                                    {ship.seal_no && <span>Seal: <strong>{ship.seal_no}</strong></span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  {/* Info badge */}
                                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 text-xs font-semibold text-slate-300">
                                    Status: <span className="text-blue-400 capitalize">{ship.status.replace(/_/g, " ")}</span>
                                  </div>
                                </div>
                              </div>

                              {/* DUAL STEPPER SYSTEM */}
                              <div className="py-6 border-y border-slate-900 bg-slate-950/20 px-6 rounded-2xl flex flex-col lg:flex-row justify-between gap-8 lg:gap-12 select-none">
                                {/* Timeline 1: Vessel & Transit Tracking */}
                                <div className="space-y-4 flex-1">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                                    {ship.shipment_type === "domestic" ? "Physical Logistics Line" : "Vessel & Transit Tracking"}
                                  </div>
                                  {(() => {
                                    const type = ship.shipment_type || "container";
                                    const shipStatus = ship.status || (ship as any).shipment_status;
                                    const getPhysicalActiveIndex = (status: string) => {
                                      if (status === "pending_production") return 0;
                                      if (status === "pending_packaging") return 1;
                                      if (status === "awaiting_loading" || status === "loaded_into_container" || status === "awaiting_bl_confirmation" || status === "awaiting_all_docs") return 2;
                                      if (status === "etd") return 3;
                                      if (status === "eta") return 4;
                                      return 0;
                                    };
                                    const activePhysIndex = getPhysicalActiveIndex(shipStatus || "");
                                    let physStages = ["Prod", "Pack", "Loaded", "ETD", "ETA"];
                                    if (type === "bulk") {
                                      physStages = ["Production", "Barge Loading", "River Transit", "Sichang Anchorage", "Sailing (ETD/ETA)"];
                                    } else if (type === "domestic") {
                                      physStages = ["Production", "Queueing", "Delivered"];
                                    }
                                    const clampedPhysIndex = Math.min(activePhysIndex, physStages.length - 1);
                                    const isPhysPulse = shipStatus !== "eta";

                                    return (
                                      <div className="relative w-full pt-2 pb-12 px-8">
                                        {/* Background Track Line */}
                                        <div className="absolute top-[18px] left-8 right-8 h-[2px] bg-slate-800/80 rounded-full z-0">
                                          {/* Active Progress Line */}
                                          <div 
                                            className="h-full bg-emerald-500/80 rounded-full transition-all duration-500 ease-in-out"
                                            style={{ width: `${(clampedPhysIndex / (physStages.length - 1)) * 100}%` }}
                                          ></div>
                                        </div>

                                        {/* Nodes Container */}
                                        <div className="flex justify-between items-center relative z-10 w-full">
                                          {physStages.map((label, idx) => {
                                            const isCompleted = idx < clampedPhysIndex;
                                            const isActive = idx === clampedPhysIndex;
                                            
                                            return (
                                              <div key={label} className="flex flex-col items-center relative">
                                                {/* Circular Node */}
                                                <div 
                                                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
                                                    isCompleted 
                                                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/20 text-slate-950" 
                                                      : isActive 
                                                        ? `bg-emerald-500 text-slate-950 font-bold ring-4 ring-emerald-500/30 ${isPhysPulse ? "animate-pulse" : ""}`
                                                        : "bg-slate-900 border border-slate-800 text-slate-600"
                                                  }`}
                                                >
                                                  {isCompleted ? (
                                                    <svg className="w-3 h-3 text-slate-950 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                  ) : isActive ? (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                                  ) : (
                                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                  )}
                                                </div>
                                                {/* Absolute Label below node */}
                                                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-16 text-center">
                                                  <span 
                                                    className={`text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider transition-colors duration-300 ${
                                                      isActive 
                                                        ? "text-emerald-400 font-extrabold" 
                                                        : isCompleted 
                                                          ? "text-slate-300 font-semibold" 
                                                          : "text-slate-600 font-medium"
                                                    }`}
                                                  >
                                                    {label}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Divider for tablet/mobile viewports */}
                                <div className="lg:hidden h-[1px] bg-slate-900 border-t border-slate-800/50 w-full" />
                                <div className="hidden lg:block w-[1px] min-h-[70px] bg-slate-900 border-l border-slate-800/50 self-stretch my-2" />

                                {/* Timeline 2: Document Clearance Hub */}
                                <div className="space-y-4 flex-1">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                                    {ship.shipment_type === "domestic" ? "Domestic Docs Clearance" : "Document Clearance Hub"}
                                  </div>
                                  {(() => {
                                    const type = ship.shipment_type || "container";
                                    const shipStatus = ship.status || (ship as any).shipment_status;
                                    const getDocActiveIndex = (s: typeof ship, status: string) => {
                                      if (s.doc_status) {
                                        if (s.doc_status === "get_booking") return 0;
                                        if (s.doc_status === "preparing_docs") return 1;
                                        if (s.doc_status === "confirm_bl" || s.doc_status === "bl_stage") return 2;
                                        if (s.doc_status === "confirm_draft_docs") return 3;
                                        if (s.doc_status === "all_ship_docs_completed") return 4;
                                      }
                                      if (status === "eta" || (s.bl_approval_status === "approved" && s.shipping_docs_link)) {
                                        return 4;
                                      }
                                      if (s.bl_approval_status === "approved" || s.bl_draft_link) {
                                        return 3;
                                      }
                                      if (s.booking_no || status === "awaiting_bl_confirmation" || status === "awaiting_all_docs") {
                                        return 2;
                                      }
                                      if (status === "pending_production") {
                                        return 0;
                                      }
                                      return 1;
                                    };
                                    const activeDocIndex = getDocActiveIndex(ship, shipStatus || "");
                                    const docActiveStatus = ship.doc_status || (
                                      activeDocIndex === 4 ? "all_ship_docs_completed" :
                                      activeDocIndex === 3 ? "confirm_draft_docs" :
                                      activeDocIndex === 2 ? "confirm_bl" :
                                      activeDocIndex === 1 ? "preparing_docs" : "get_booking"
                                    );
                                    const isDocPulse = docActiveStatus !== "all_ship_docs_completed";
                                    
                                    let docStages = ["Book", "Prep", "BL", "Draft", "All Completed"];
                                    if (type === "bulk") {
                                      docStages = ["PO Issued", "WH Weight", "Draft Docs", "All Ship Docs"];
                                    } else if (type === "domestic") {
                                      docStages = ["PO Issued", "Delivery Order", "Invoice", "Paid"];
                                    }
                                    const clampedDocIndex = Math.min(activeDocIndex, docStages.length - 1);

                                    return (
                                      <div className="relative w-full pt-2 pb-12 px-8">
                                        {/* Background Track Line */}
                                        <div className="absolute top-[18px] left-8 right-8 h-[2px] bg-slate-800/80 rounded-full z-0">
                                          {/* Active Progress Line */}
                                          <div 
                                            className="h-full bg-emerald-500/80 rounded-full transition-all duration-500 ease-in-out"
                                            style={{ width: `${(clampedDocIndex / (docStages.length - 1)) * 100}%` }}
                                          ></div>
                                        </div>

                                        {/* Nodes Container */}
                                        <div className="flex justify-between items-center relative z-10 w-full">
                                          {docStages.map((label, idx) => {
                                            const isCompleted = idx < clampedDocIndex;
                                            const isActive = idx === clampedDocIndex;
                                            
                                            return (
                                              <div key={label} className="flex flex-col items-center relative">
                                                {/* Circular Node */}
                                                <div 
                                                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
                                                    isCompleted 
                                                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/20 text-slate-950" 
                                                      : isActive 
                                                        ? `bg-emerald-500 text-slate-950 font-bold ring-4 ring-emerald-500/30 ${isDocPulse ? "animate-pulse" : ""}`
                                                        : "bg-slate-900 border border-slate-800 text-slate-600"
                                                  }`}
                                                >
                                                  {isCompleted ? (
                                                    <svg className="w-3 h-3 text-slate-950 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                  ) : isActive ? (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                                  ) : (
                                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                  )}
                                                </div>
                                                {/* Absolute Label below node */}
                                                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-16 text-center">
                                                  <span 
                                                    className={`text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider transition-colors duration-300 ${
                                                      isActive 
                                                        ? "text-emerald-400 font-extrabold" 
                                                        : isCompleted 
                                                          ? "text-slate-300 font-semibold" 
                                                          : "text-slate-600 font-medium"
                                                    }`}
                                                  >
                                                    {label}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>


                              {/* Logistics details and Document Hub */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-900/60 items-start">
                                 {/* Details list - Refactored to Ocean Freight Transit Profile */}
                                 <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/80 shadow-inner relative overflow-hidden group hover:border-slate-700/60 transition-all duration-300">
                                   <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
                                   
                                   <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-800/50 uppercase tracking-widest font-mono">
                                     <Ship className="w-4 h-4 text-blue-400 animate-pulse" /> Ocean Freight Transit Profile
                                   </h5>
                                   
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/10 flex items-center justify-center shrink-0">
                                         <Anchor className="w-4 h-4 text-blue-400" />
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Shipping Line / Carrier</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{ship.forwarder_id || "Awaiting Carrier Booking"}</span>
                                       </div>
                                     </div>

                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/10 flex items-center justify-center shrink-0">
                                         <Compass className="w-4 h-4 text-cyan-400" />
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Vessel / Voyage</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{ship.vessel_voyage || "Awaiting Vessel Assignment"}</span>
                                       </div>
                                     </div>

                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-500/10 flex items-center justify-center shrink-0">
                                         <MapPin className="w-4 h-4 text-emerald-400" />
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Port of Loading (POL)</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{getPorts(profile?.company_name).pol}</span>
                                       </div>
                                     </div>

                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-500/10 flex items-center justify-center shrink-0">
                                         <MapPin className="w-4 h-4 text-indigo-400" />
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Port of Discharge (POD)</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{getPorts(profile?.company_name).pod}</span>
                                       </div>
                                     </div>

                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-500/10 flex items-center justify-center shrink-0">
                                         <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                         </svg>
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estimated Departure (ETD)</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{ship.etd_date || "Scheduling Transit"}</span>
                                       </div>
                                     </div>

                                     <div className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-900/20 transition-all duration-200">
                                       <div className="w-8 h-8 rounded-lg bg-rose-950/40 border border-rose-500/10 flex items-center justify-center shrink-0">
                                         <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                         </svg>
                                       </div>
                                       <div>
                                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estimated Arrival (ETA)</span>
                                         <span className="text-white font-semibold text-xs mt-0.5 block">{ship.eta_date || "Scheduling Transit"}</span>
                                       </div>
                                     </div>
                                   </div>
                                 </div>

                                {/* Document Hub & B/L Action Module */}
                                <div className="space-y-4">
                                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                                    <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3">
                                      <FileText className="w-3.5 h-3.5 text-blue-400" /> Document Hub
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {/* B/L Draft Link */}
                                      {ship.bl_draft_link ? (
                                        <a 
                                          href={ship.bl_draft_link} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                                        >
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-amber-400" />
                                            <div>
                                              <span className="text-xs text-white block font-medium">B/L Draft</span>
                                              <span className="text-[9px] text-slate-500 block">PDF Document</span>
                                            </div>
                                          </div>
                                          <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all" />
                                        </a>
                                      ) : (
                                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center gap-2 text-slate-600">
                                          <FileText className="w-4 h-4 text-slate-750" />
                                          <div>
                                            <span className="text-xs block font-medium">B/L Draft</span>
                                            <span className="text-[9px] block">Not Available Yet</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Shipping Docs Link */}
                                      {ship.shipping_docs_link ? (
                                        <a 
                                          href={ship.shipping_docs_link} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                                        >
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-emerald-400" />
                                            <div>
                                              <span className="text-xs text-white block font-medium">Shipping Dossier</span>
                                              <span className="text-[9px] text-slate-500 block">All Files (.zip)</span>
                                            </div>
                                          </div>
                                          <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all" />
                                        </a>
                                      ) : (
                                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-950 flex items-center gap-2 text-slate-600">
                                          <FileText className="w-4 h-4 text-slate-750" />
                                          <div>
                                            <span className="text-xs block font-medium">Shipping Dossier</span>
                                            <span className="text-[9px] block">Awaiting Dispatch</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* B/L Approval Console */}
                                  {ship.status === "awaiting_bl_confirmation" && (
                                    <div className="glass-card p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                                      <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/20"></div>
                                      
                                      <h6 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                                        <AlertCircle className="w-4 h-4 text-amber-400" /> Customer Approval Action Required
                                      </h6>
                                      <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                                        Please inspect the B/L draft and verify port codes, container weights, and product specifications.
                                      </p>

                                      {ship.bl_approval_status === "approved" ? (
                                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                                          <span>Draft Approved. Logistics preparing dispatch.</span>
                                        </div>
                                      ) : ship.bl_approval_status === "rejected" ? (
                                        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-amber-400" />
                                          <span>Amendment requested. Feedbacks logged: "{ship.bl_feedback}"</span>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <textarea
                                            placeholder="Provide revision notes or feedback if requesting changes..."
                                            value={blFeedback[ship.di_no] || ""}
                                            onChange={(e) => setBlFeedback(prev => ({ ...prev, [ship.di_no]: e.target.value }))}
                                            className="w-full p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all"
                                            rows={2}
                                          />

                                          <div className="flex gap-2.5">
                                            <button
                                              onClick={() => handleBLAction(ship.di_no, "reject")}
                                              disabled={submittingBL[ship.di_no]}
                                              className="flex-1 py-2 px-3 bg-red-950/30 border border-red-500/20 hover:bg-red-900/30 text-red-400 font-semibold rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                                            >
                                              Request Revision
                                            </button>
                                            <button
                                              onClick={() => handleBLAction(ship.di_no, "approve")}
                                              disabled={submittingBL[ship.di_no]}
                                              className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                                            >
                                              Approve Draft
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
