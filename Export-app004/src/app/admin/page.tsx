"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  getCurrentUser, 
  getCustomers, 
  getPurchaseOrders, 
  getShipments, 
  updateShipment, 
  updateShipmentsBulk,
  createPurchaseOrder,
  createShipments,
  getFinancialLogs,
  saveFinancialLog,
  logoutUser,
  Customer, 
  PurchaseOrder, 
  Shipment, 
  UserProfile,
  FORWARDERS,
  VESSELS
} from "@/utils/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { 
  Plus, 
  Search, 
  Filter, 
  CheckSquare, 
  Edit3, 
  FileText, 
  LogOut, 
  Trash2,
  Calendar,
  X,
  Container,
  FolderSync,
  Eye,
  Info,
  Download,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon
} from "lucide-react";

const PIPELINE_STAGES = [
  { key: "pending_production", label: "Pending Production" },
  { key: "pending_packaging", label: "Awaiting Packaging" },
  { key: "awaiting_loading", label: "Awaiting Loading" },
  { key: "loaded_into_container", label: "Loaded into Container" },
  { key: "awaiting_bl_confirmation", label: "Awaiting B/L Confirmation" },
  { key: "awaiting_all_docs", label: "Awaiting All Shipping Documents" },
  { key: "etd", label: "ETD (Departure)" },
  { key: "eta", label: "ETA (Destination)" },
];

export default function AdminPortal() {
  return (
    <ProtectedRoute allowedRole="admin">
      <AdminPortalContent />
    </ProtectedRoute>
  );
}

interface CostRow {
  item: string;
  supplier: string;
  baseAmount: number;
  vatAmount: number;
  whtAmount: number;
  netPaid: number;
  transferDate: string;
}

const CONTAINER_DEFAULT_ROWS: CostRow[] = [
  { item: "Shipping Agency Fee", supplier: "Nt2020", baseAmount: 150, vatAmount: 10.5, whtAmount: 4.5, netPaid: 156, transferDate: "2026-05-27" },
  { item: "BL Document Fee", supplier: "APS", baseAmount: 50, vatAmount: 3.5, whtAmount: 1.5, netPaid: 52, transferDate: "2026-05-27" },
  { item: "Surveyor Fee", supplier: "COTECNA", baseAmount: 200, vatAmount: 14, whtAmount: 6, netPaid: 208, transferDate: "2026-05-27" },
  { item: "Container Haulage", supplier: "มีโชค", baseAmount: 300, vatAmount: 21, whtAmount: 3, netPaid: 318, transferDate: "2026-05-27" },
  { item: "Documentation & Certs", supplier: "RDI", baseAmount: 50, vatAmount: 3.5, whtAmount: 1.5, netPaid: 52, transferDate: "2026-05-27" },
  { item: "Sales Broker Commission", supplier: "ไทยโอกา", baseAmount: 120, vatAmount: 8.4, whtAmount: 3.6, netPaid: 124.8, transferDate: "2026-05-27" }
];

const BULK_DEFAULT_ROWS: CostRow[] = [
  { item: "Port Wharfage & Weighing", supplier: "มอ ลิงค์", baseAmount: 150, vatAmount: 10.5, whtAmount: 1.5, netPaid: 159, transferDate: "2026-05-27" },
  { item: "Shipping Agency Fee", supplier: "NCT2020", baseAmount: 120, vatAmount: 8.4, whtAmount: 3.6, netPaid: 124.8, transferDate: "2026-05-27" },
  { item: "Barge Freight & Towage", supplier: "ไทยขนคือการ", baseAmount: 500, vatAmount: 35, whtAmount: 5, netPaid: 530, transferDate: "2026-05-27" },
  { item: "Stevedoring Labor Charge", supplier: "เทมารักษ์", baseAmount: 300, vatAmount: 21, whtAmount: 9, netPaid: 312, transferDate: "2026-05-27" },
  { item: "Surveyor Inspection Fee", supplier: "SGS", baseAmount: 180, vatAmount: 12.6, whtAmount: 5.4, netPaid: 187.2, transferDate: "2026-05-27" },
  { item: "Documentation & Certs", supplier: "RDI", baseAmount: 40, vatAmount: 2.8, whtAmount: 1.2, netPaid: 41.6, transferDate: "2026-05-27" },
  { item: "Despatch Cashback Credit", supplier: "เทมารักษ์", baseAmount: 1000, vatAmount: 0, whtAmount: 10, netPaid: 990, transferDate: "2026-05-27" }
];

const DOMESTIC_DEFAULT_ROWS: CostRow[] = [
  { item: "Cross-Border Trucking", supplier: "มีโชค", baseAmount: 800, vatAmount: 56, whtAmount: 8, netPaid: 848, transferDate: "2026-05-27" },
  { item: "Transit Customs Fee", supplier: "RDI", baseAmount: 200, vatAmount: 14, whtAmount: 6, netPaid: 208, transferDate: "2026-05-27" },
  { item: "Cross-Docking Handling", supplier: "มอ ลิงค์", baseAmount: 150, vatAmount: 10.5, whtAmount: 4.5, netPaid: 156, transferDate: "2026-05-27" }
];

function AdminPortalContent() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("wcat_theme") as "dark" | "light" | null;
    if (savedTheme) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  
  // Master lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  
  // Lane Packing Algorithm for visual alignment of multi-day Gantt spanned bars
  const shipmentLanes = useMemo(() => {
    const scheduled = shipments.filter(s => s.loading_start_date || s.etd_date);

    const getDuration = (s: Shipment) => {
      const start = new Date(s.loading_start_date || s.etd_date || "");
      const end = new Date(s.loading_end_date || s.etd_date || "");
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    };

    const sorted = [...scheduled].sort((a, b) => {
      const startA = a.loading_start_date || a.etd_date || "";
      const startB = b.loading_start_date || b.etd_date || "";
      if (startA !== startB) {
        return startA.localeCompare(startB);
      }
      return getDuration(b) - getDuration(a);
    });

    const lanes: Shipment[][] = [];

    sorted.forEach(ship => {
      const startStr = ship.loading_start_date || ship.etd_date || "";
      const endStr = ship.loading_end_date || ship.etd_date || "";

      let assignedLaneIdx = -1;
      for (let i = 0; i < lanes.length; i++) {
        const laneShipments = lanes[i];
        const hasOverlap = laneShipments.some(s => {
          const sStart = s.loading_start_date || s.etd_date || "";
          const sEnd = s.loading_end_date || s.etd_date || "";
          return !(endStr < sStart || startStr > sEnd);
        });

        if (!hasOverlap) {
          assignedLaneIdx = i;
          break;
        }
      }

      if (assignedLaneIdx === -1) {
        lanes.push([ship]);
      } else {
        lanes[assignedLaneIdx].push(ship);
      }
    });

    const laneMap: Record<string, number> = {};
    lanes.forEach((laneShipments, laneIdx) => {
      laneShipments.forEach(ship => {
        laneMap[ship.di_no] = laneIdx;
      });
    });

    return { laneMap, maxLanes: lanes.length };
  }, [shipments]);
  
  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<"logs" | "create" | "calendar" | "freight" | "financial">("create");

  // Freight Pricing Subsystem States
  interface MarketIndex {
    id: string;
    monthYear: string;
    period: "1st Half" | "2nd Half";
    destinationPort: string;
    mode: "20' CONT" | "40' HQ" | "Bulk Vessel";
    marketRate: number;
  }

  interface ActualBooking {
    id: string;
    diNumber: string;
    destinationPort: string;
    mode: "20' CONT" | "40' HQ" | "Bulk Vessel";
    forwarderPartner: string;
    wcatRate: number;
    bookingDate: string;
    targetMonth?: string;
  }

  interface ShipmentFinancials {
    id: string;
    diNumber: string;
    shipmentType: "container" | "bulk" | "domestic";
    invoiceNo: string;
    customer: string;
    product: string;
    volumeMt: number;
    sellingPrice: number;
    revenue: number;
    cogs: number;
    costRows: CostRow[];
  }

  const [marketIndexes, setMarketIndexes] = useState<MarketIndex[]>([
    {
      id: "m1",
      monthYear: "May 2026",
      period: "1st Half",
      destinationPort: "Qingdao",
      mode: "20' CONT",
      marketRate: 1000
    },
    {
      id: "m1-2",
      monthYear: "May 2026",
      period: "2nd Half",
      destinationPort: "Qingdao",
      mode: "20' CONT",
      marketRate: 950
    },
    {
      id: "m2",
      monthYear: "May 2026",
      period: "1st Half",
      destinationPort: "Los Angeles",
      mode: "40' HQ",
      marketRate: 1500
    },
    {
      id: "m2-2",
      monthYear: "May 2026",
      period: "2nd Half",
      destinationPort: "Los Angeles",
      mode: "40' HQ",
      marketRate: 1450
    },
    {
      id: "m3",
      monthYear: "May 2026",
      period: "1st Half",
      destinationPort: "Rotterdam",
      mode: "Bulk Vessel",
      marketRate: 100
    },
    {
      id: "m3-2",
      monthYear: "May 2026",
      period: "2nd Half",
      destinationPort: "Rotterdam",
      mode: "Bulk Vessel",
      marketRate: 95
    },
    {
      id: "m4",
      monthYear: "May 2026",
      period: "1st Half",
      destinationPort: "Singapore",
      mode: "20' CONT",
      marketRate: 600
    },
    {
      id: "m5",
      monthYear: "May 2026",
      period: "1st Half",
      destinationPort: "Hamburg",
      mode: "40' HQ",
      marketRate: 1800
    }
  ]);

  const [actualBookings, setActualBookings] = useState<ActualBooking[]>([
    {
      id: "b1",
      diNumber: "DI-2601-A6",
      destinationPort: "Qingdao",
      mode: "20' CONT",
      forwarderPartner: "OOCL",
      wcatRate: 950,
      bookingDate: "2026-05-10",
      targetMonth: "May 2026"
    },
    {
      id: "b2",
      diNumber: "DI-2601-A7",
      destinationPort: "Los Angeles",
      mode: "40' HQ",
      forwarderPartner: "ONE",
      wcatRate: 1550,
      bookingDate: "2026-05-12",
      targetMonth: "May 2026"
    },
    {
      id: "b3",
      diNumber: "DI-2603-C6",
      destinationPort: "Rotterdam",
      mode: "Bulk Vessel",
      forwarderPartner: "Maersk",
      wcatRate: 85,
      bookingDate: "2026-05-18",
      targetMonth: "May 2026"
    }
  ]);

  const [freightSubTab, setFreightSubTab] = useState<"market" | "bookings">("bookings");

  const [marketForm, setMarketForm] = useState({
    monthYear: "May 2026",
    period: "1st Half" as "1st Half" | "2nd Half",
    destinationPort: "",
    mode: "20' CONT" as "20' CONT" | "40' HQ" | "Bulk Vessel",
    marketRate: ""
  });

  const [bookingForm, setBookingForm] = useState({
    diNumber: "",
    destinationPort: "",
    mode: "20' CONT" as "20' CONT" | "40' HQ" | "Bulk Vessel",
    forwarderPartner: "",
    wcatRate: "",
    bookingDate: ""
  });

  const [financialLogs, setFinancialLogs] = useState<ShipmentFinancials[]>([
    {
      id: "f1",
      diNumber: "DI-2601-A6",
      shipmentType: "container",
      invoiceNo: "INV-DI-2601-A6_2025",
      customer: "Apex Global Logistics",
      product: "Tapioca Flour Extra",
      volumeMt: 35,
      sellingPrice: 450,
      revenue: 15750,
      cogs: 11025,
      costRows: [
        { item: "Shipping Agency Fee", supplier: "Nt2020", baseAmount: 150, vatAmount: 10.5, whtAmount: 4.5, netPaid: 156, transferDate: "2026-05-27" },
        { item: "BL Document Fee", supplier: "APS", baseAmount: 50, vatAmount: 3.5, whtAmount: 1.5, netPaid: 52, transferDate: "2026-05-27" },
        { item: "Surveyor Fee", supplier: "COTECNA", baseAmount: 200, vatAmount: 14, whtAmount: 6, netPaid: 208, transferDate: "2026-05-27" },
        { item: "Container Haulage", supplier: "มีโชค", baseAmount: 300, vatAmount: 21, whtAmount: 3, netPaid: 318, transferDate: "2026-05-27" },
        { item: "Documentation & Certs", supplier: "RDI", baseAmount: 50, vatAmount: 3.5, whtAmount: 1.5, netPaid: 52, transferDate: "2026-05-27" },
        { item: "Sales Broker Commission", supplier: "ไทยโอกา", baseAmount: 120, vatAmount: 8.4, whtAmount: 3.6, netPaid: 124.8, transferDate: "2026-05-27" }
      ]
    },
    {
      id: "f2",
      diNumber: "DI-2601-A7",
      shipmentType: "container",
      invoiceNo: "INV-DI-2601-A7_2025",
      customer: "Apex Global Logistics",
      product: "Tapioca Pearls Premium",
      volumeMt: 100,
      sellingPrice: 750,
      revenue: 75000,
      cogs: 52500,
      costRows: [
        { item: "Shipping Agency Fee", supplier: "Nt2020", baseAmount: 180, vatAmount: 12.6, whtAmount: 5.4, netPaid: 187.2, transferDate: "2026-05-27" },
        { item: "BL Document Fee", supplier: "APS", baseAmount: 60, vatAmount: 4.2, whtAmount: 1.8, netPaid: 62.4, transferDate: "2026-05-27" },
        { item: "Surveyor Fee", supplier: "COTECNA", baseAmount: 250, vatAmount: 17.5, whtAmount: 7.5, netPaid: 260, transferDate: "2026-05-27" },
        { item: "Container Haulage", supplier: "มีโชค", baseAmount: 400, vatAmount: 28, whtAmount: 4, netPaid: 424, transferDate: "2026-05-27" },
        { item: "Documentation & Certs", supplier: "RDI", baseAmount: 60, vatAmount: 4.2, whtAmount: 1.8, netPaid: 62.4, transferDate: "2026-05-27" },
        { item: "Sales Broker Commission", supplier: "ไทยโอกา", baseAmount: 150, vatAmount: 10.5, whtAmount: 4.5, netPaid: 156, transferDate: "2026-05-27" }
      ]
    },
    {
      id: "f3",
      diNumber: "DI-2603-C6",
      shipmentType: "bulk",
      invoiceNo: "INV-DI-2603-C6_2025",
      customer: "Vortex Industrial Co",
      product: "Tapioca Flour Extra",
      volumeMt: 120,
      sellingPrice: 650,
      revenue: 78000,
      cogs: 54600,
      costRows: [
        { item: "Port Wharfage & Weighing", supplier: "มอ ลิงค์", baseAmount: 150, vatAmount: 10.5, whtAmount: 1.5, netPaid: 159, transferDate: "2026-05-27" },
        { item: "Shipping Agency Fee", supplier: "NCT2020", baseAmount: 120, vatAmount: 8.4, whtAmount: 3.6, netPaid: 124.8, transferDate: "2026-05-27" },
        { item: "Barge Freight & Towage", supplier: "ไทยขนคือการ", baseAmount: 500, vatAmount: 35, whtAmount: 5, netPaid: 530, transferDate: "2026-05-27" },
        { item: "Stevedoring Labor Charge", supplier: "เทมารักษ์", baseAmount: 300, vatAmount: 21, whtAmount: 9, netPaid: 312, transferDate: "2026-05-27" },
        { item: "Surveyor Inspection Fee", supplier: "SGS", baseAmount: 180, vatAmount: 12.6, whtAmount: 5.4, netPaid: 187.2, transferDate: "2026-05-27" },
        { item: "Documentation & Certs", supplier: "RDI", baseAmount: 40, vatAmount: 2.8, whtAmount: 1.2, netPaid: 41.6, transferDate: "2026-05-27" },
        { item: "Despatch Cashback Credit", supplier: "เทมารักษ์", baseAmount: 1000, vatAmount: 0, whtAmount: 10, netPaid: 990, transferDate: "2026-05-27" }
      ]
    }
  ]);

  const [financialForm, setFinancialForm] = useState({
    diNumber: "",
    shipmentType: "container" as "container" | "bulk" | "domestic",
    invoiceNo: "",
    customer: "",
    product: "",
    volumeMt: "",
    sellingPrice: "",
    revenue: 0,
    cogs: "",
    costRows: [] as Array<{
      item: string;
      supplier: string;
      baseAmount: string;
      vatAmount: string;
      whtAmount: string;
      netPaid: number;
      transferDate: string;
    }>
  });

  const [selectedTrendPort, setSelectedTrendPort] = useState("Qingdao");
  const [selectedTrendMode, setSelectedTrendMode] = useState<"20' CONT" | "40' HQ" | "Bulk Vessel">("20' CONT");

  // Summation engine for active financial form costRows
  const formTotalShipmentCost = useMemo(() => {
    let expenseSum = 0;
    financialForm.costRows.forEach(row => {
      const net = parseFloat(row.netPaid?.toString()) || 0;
      if (row.item === "Despatch Cashback Credit" || row.item.includes("Despatch")) {
        expenseSum -= net;
      } else {
        expenseSum += net;
      }
    });
    
    const cogsVal = parseFloat(financialForm.cogs) || 0;
    
    // Auto-match Ocean Freight using bi-weekly rate tracking subsystem
    let oceanFreight = 0;
    const ship = shipments.find(s => s.di_no === financialForm.diNumber);
    if (ship) {
      const actualBookingMatch = actualBookings.find(b => b.diNumber === financialForm.diNumber);
      if (actualBookingMatch) {
        oceanFreight = actualBookingMatch.wcatRate;
      } else if (ship.etd_date) {
        const dateObj = new Date(ship.etd_date);
        if (!isNaN(dateObj.getTime())) {
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const targetMonth = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
          const ratePeriod = dateObj.getDate() <= 15 ? "1st Half" : "2nd Half";
          const resolvedMode = (ship.container_size === "40' HQ" || ship.container_size === "40'") 
            ? "40' HQ" 
            : (ship.shipment_type === "bulk" ? "Bulk Vessel" : "20' CONT");
          
          let resolvedPort = "Qingdao";
          if (ship.destination_country === "United States") resolvedPort = "Los Angeles";
          else if (ship.destination_country === "Germany" || ship.destination_country === "Netherlands") resolvedPort = "Rotterdam";
          else if (ship.destination_country === "Singapore") resolvedPort = "Singapore";
          else if (ship.destination_country === "China") resolvedPort = "Shanghai";

          const marketMatch = marketIndexes.find(
            (mi) =>
              mi.monthYear === targetMonth &&
              mi.period === ratePeriod &&
              mi.destinationPort.toLowerCase() === resolvedPort.toLowerCase() &&
              mi.mode === resolvedMode
          );
          if (marketMatch) {
            oceanFreight = marketMatch.marketRate;
          }
        }
      }
    }
    
    return cogsVal + expenseSum + oceanFreight;
  }, [financialForm.costRows, financialForm.cogs, financialForm.diNumber, shipments, actualBookings, marketIndexes]);

  // Dynamic 12-month Trend Data Resolver (JAN - DEC)
  const trendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // Calibrate base rates dynamically depending on port and mode
    let baseRate = 1000;
    if (selectedTrendPort === "Los Angeles") baseRate = 1500;
    else if (selectedTrendPort === "Rotterdam") baseRate = 1200;
    else if (selectedTrendPort === "Singapore") baseRate = 900;
    else if (selectedTrendPort === "Hamburg") baseRate = 1300;
    else if (selectedTrendPort === "Shanghai") baseRate = 950;

    if (selectedTrendMode === "40' HQ") baseRate = baseRate * 1.5;
    else if (selectedTrendMode === "Bulk Vessel") baseRate = baseRate * 0.1; // Bulk Vessel per MT is significantly cheaper

    // 12-month seasonal curve multipliers
    const seasonalMultipliers = [1.10, 1.05, 0.95, 0.98, 1.00, 1.02, 1.05, 1.08, 1.15, 1.20, 1.25, 1.30];

    return months.map((month, idx) => {
      const multiplier = seasonalMultipliers[idx];
      let market = Math.round(baseRate * multiplier);
      let wcat = Math.round(market * 0.93 + (idx % 2 === 0 ? 10 : -15)); // averages a nice 7% savings corridor

      const currentYear = "2026";
      const fullMonthName = fullMonths[idx];
      const targetMonthYear = `${fullMonthName} ${currentYear}`;

      // Overwrite with actual logged averages from MarketIndex state if found
      const matchingIndices = marketIndexes.filter(
        (m) =>
          m.monthYear === targetMonthYear &&
          m.destinationPort.toLowerCase() === selectedTrendPort.toLowerCase() &&
          m.mode === selectedTrendMode
      );
      if (matchingIndices.length > 0) {
        const sum = matchingIndices.reduce((acc, curr) => acc + curr.marketRate, 0);
        market = Math.round(sum / matchingIndices.length);
      }

      // Overwrite with WCAT live bookings averages if found in ActualBooking state
      const matchingBookings = actualBookings.filter(
        (b) =>
          b.targetMonth === targetMonthYear &&
          b.destinationPort.toLowerCase() === selectedTrendPort.toLowerCase() &&
          b.mode === selectedTrendMode
      );
      if (matchingBookings.length > 0) {
        const sum = matchingBookings.reduce((acc, curr) => acc + curr.wcatRate, 0);
        wcat = Math.round(sum / matchingBookings.length);
      }

      return {
        month,
        market,
        wcat,
        saving: market - wcat
      };
    });
  }, [selectedTrendPort, selectedTrendMode, marketIndexes, actualBookings]);

  // Compute SVG Coordinates, Gridlines, Line Paths, and Area Fills
  const chartCoords = useMemo(() => {
    const minVal = Math.max(0, Math.min(...trendData.map(d => Math.min(d.market, d.wcat))) * 0.9);
    const maxVal = Math.max(...trendData.map(d => Math.max(d.market, d.wcat))) * 1.1;
    const valRange = maxVal - minVal || 1;

    const width = 600;
    const height = 240;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const points = trendData.map((d, idx) => {
      const x = paddingLeft + (idx * chartWidth) / 11;
      const yMarket = paddingTop + chartHeight - ((d.market - minVal) / valRange) * chartHeight;
      const yWcat = paddingTop + chartHeight - ((d.wcat - minVal) / valRange) * chartHeight;

      return {
        x,
        yMarket,
        yWcat,
        ...d
      };
    });

    // Generate Path descriptions
    const marketLinePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.yMarket}`).join(" ");
    const wcatLinePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.yWcat}`).join(" ");

    const marketAreaPath = `${marketLinePath} L ${points[11].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    const wcatAreaPath = `${wcatLinePath} L ${points[11].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

    // Dynamic Y Ticks Axis
    const ticksCount = 5;
    const yTicks = Array.from({ length: ticksCount }).map((_, idx) => {
      const val = Math.round(minVal + (idx * valRange) / (ticksCount - 1));
      const y = paddingTop + chartHeight - (idx * chartHeight) / (ticksCount - 1);
      return { val, y };
    });

    return {
      points,
      marketLinePath,
      wcatLinePath,
      marketAreaPath,
      wcatAreaPath,
      yTicks,
      minVal,
      maxVal
    };
  }, [trendData]);

  // Helper to compute dynamic costs and auto-match bi-weekly Ocean Freight for financials
  const getShipmentCostDetails = useCallback((log: ShipmentFinancials) => {
    let expenseSum = 0;
    if (log.costRows && Array.isArray(log.costRows)) {
      log.costRows.forEach(row => {
        if (row.item === "Despatch Cashback Credit" || row.item.includes("Despatch")) {
          // Despatch is treated as cost reduction
          expenseSum -= row.netPaid;
        } else {
          expenseSum += row.netPaid;
        }
      });
    }

    let totalCosts = (log.cogs || 0) + expenseSum;

    // Auto-match Ocean Freight using bi-weekly rate tracking subsystem
    const ship = shipments.find(s => s.di_no === log.diNumber);
    let oceanFreight = 0;
    if (ship) {
      const actualBookingMatch = actualBookings.find(b => b.diNumber === log.diNumber);
      if (actualBookingMatch) {
        oceanFreight = actualBookingMatch.wcatRate;
      } else if (ship.etd_date) {
        const dateObj = new Date(ship.etd_date);
        if (!isNaN(dateObj.getTime())) {
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const targetMonth = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
          const ratePeriod = dateObj.getDate() <= 15 ? "1st Half" : "2nd Half";
          const resolvedMode = (ship.container_size === "40' HQ" || ship.container_size === "40'") 
            ? "40' HQ" 
            : (ship.shipment_type === "bulk" ? "Bulk Vessel" : "20' CONT");
          
          let resolvedPort = "Qingdao";
          if (ship.destination_country === "United States") resolvedPort = "Los Angeles";
          else if (ship.destination_country === "Germany" || ship.destination_country === "Netherlands") resolvedPort = "Rotterdam";
          else if (ship.destination_country === "Singapore") resolvedPort = "Singapore";
          else if (ship.destination_country === "China") resolvedPort = "Shanghai";

          const marketMatch = marketIndexes.find(
            (mi) =>
              mi.monthYear === targetMonth &&
              mi.period === ratePeriod &&
              mi.destinationPort.toLowerCase() === resolvedPort.toLowerCase() &&
              mi.mode === resolvedMode
          );
          if (marketMatch) {
            oceanFreight = marketMatch.marketRate;
          }
        }
      }
    }

    totalCosts += oceanFreight;
    return { totalCosts, oceanFreight };
  }, [shipments, actualBookings, marketIndexes]);

  // Dynamic Monthly Net Profit Tracker (JAN - DEC)
  const monthlyNetProfitData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return months.map((month, idx) => {
      const matchingLogs = financialLogs.filter((f) => {
        const ship = shipments.find(s => s.di_no === f.diNumber);
        if (ship && ship.etd_date) {
          const date = new Date(ship.etd_date);
          return !isNaN(date.getTime()) && date.getMonth() === idx;
        }
        return false;
      });
      
      let netProfitVal = 0;
      if (matchingLogs.length > 0) {
        netProfitVal = matchingLogs.reduce((acc, curr) => {
          const { totalCosts } = getShipmentCostDetails(curr);
          return acc + (curr.revenue - totalCosts);
        }, 0);
      } else {
        const baseNetProfits = [1500, 1800, 1200, 1400, 2000, 1900, 2200, 2500, 2900, 3200, 3500, 4200];
        netProfitVal = baseNetProfits[idx];
      }
      
      return { month, netProfit: netProfitVal };
    });
  }, [financialLogs, shipments, getShipmentCostDetails]);

  // Compute SVG Coordinates, Line Paths, and Area Fills for Net Profit Trend Chart
  const financialChartCoords = useMemo(() => {
    const minVal = Math.min(0, ...monthlyNetProfitData.map(d => d.netProfit)) * 0.9;
    const maxVal = Math.max(100, ...monthlyNetProfitData.map(d => d.netProfit)) * 1.1;
    const valRange = maxVal - minVal || 1;

    const width = 600;
    const height = 180;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const points = monthlyNetProfitData.map((d, idx) => {
      const x = paddingLeft + (idx * chartWidth) / 11;
      const y = paddingTop + chartHeight - ((d.netProfit - minVal) / valRange) * chartHeight;
      return { x, y, ...d };
    });

    const linePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[11].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

    const ticksCount = 4;
    const yTicks = Array.from({ length: ticksCount }).map((_, idx) => {
      const val = Math.round(minVal + (idx * valRange) / (ticksCount - 1));
      const y = paddingTop + chartHeight - (idx * chartHeight) / (ticksCount - 1);
      return { val, y };
    });

    return { points, linePath, areaPath, yTicks };
  }, [monthlyNetProfitData]);



  // Interactive Calendar States
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date(2026, 4, 24)); // Seeded May 2026 initial calendar viewport
  const [selectedCalendarDI, setSelectedCalendarDI] = useState<Shipment | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [selectedShipmentTypeFilter, setSelectedShipmentTypeFilter] = useState("all");

  // Selection for bulk operations
  const [selectedDIIds, setSelectedDIIds] = useState<string[]>([]);
  
  // Bulk controls
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkETD, setBulkETD] = useState("");
  const [bulkETA, setBulkETA] = useState("");
  const [updatingBulk, setUpdatingBulk] = useState(false);

  // Edit Drawer state
  const [editingDI, setEditingDI] = useState<Shipment | null>(null);
  const [impersonatedShipment, setImpersonatedShipment] = useState<Shipment | null>(null);
  const [blFeedback, setBlFeedback] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"general" | "logistics" | "status">("general");

  // Split Form state
  const [newPO, setNewPO] = useState({
    po_no: "",
    customer_id: "",
    po_date: new Date().toISOString().split("T")[0],
    total_amount_usd: 0,
    payment_term: "30 Days Net",
    sales_person_id: "SALES-01",
    shipment_type: "container" as "container" | "bulk" | "domestic"
  });
  const [splitDIs, setSplitDIs] = useState<Array<{
    di_no: string;
    product_id: string;
    quantity_tons: number;
  }>>([
    { di_no: "DI-XXXX-1", product_id: "PROD-AUSTENITE-22", quantity_tons: 10.0 }
  ]);
  const [creatingPO, setCreatingPO] = useState(false);
  const [selectedPOForSplit, setSelectedPOForSplit] = useState<PurchaseOrder | null>(null);
  const [newSplitRows, setNewSplitRows] = useState<Array<{ di_no: string; product_id: string; quantity_tons: number }>>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Notification Banner
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Initial Data Load
  const loadAllData = async () => {
    try {
      const custs = await getCustomers();
      const pos = await getPurchaseOrders();
      const ships = await getShipments();
      const finLogs = await getFinancialLogs();
      
      setCustomers(custs);
      setPurchaseOrders(pos);
      setShipments(ships);
      if (finLogs && finLogs.length > 0) {
        setFinancialLogs(finLogs);
      }
    } catch (err) {
      console.error("Failed to query administration logs:", err);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(user);
      loadAllData();
    }
  }, []);

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4050);
  };

  // Toggle selection checkbox
  const toggleSelectDI = (diNo: string) => {
    setSelectedDIIds(prev => 
      prev.includes(diNo) ? prev.filter(id => id !== diNo) : [...prev, diNo]
    );
  };

  const toggleSelectAll = (filteredDIs: Shipment[]) => {
    const filteredIds = filteredDIs.map(d => d.di_no);
    const allSelected = filteredIds.every(id => selectedDIIds.includes(id));
    
    if (allSelected) {
      setSelectedDIIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedDIIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Executing Bulk update
  const handleBulkUpdate = async () => {
    if (selectedDIIds.length === 0) return;
    setUpdatingBulk(true);

    const updates: Partial<Shipment> = {};
    if (bulkStatus) updates.status = bulkStatus as Shipment["status"];
    if (bulkETD) updates.etd_date = bulkETD;
    if (bulkETA) updates.eta_date = bulkETA;

    // Automatically set fallback links on bulk doc status jumps for rich demo
    if (bulkStatus === "awaiting_bl_confirmation") {
      updates.bl_draft_link = "https://example.com/drafts/bl-bulk-draft.pdf";
      updates.bl_approval_status = "pending";
    }

    try {
      const success = await updateShipmentsBulk(selectedDIIds, updates);
      if (success) {
        showNotification(`Bulk update successfully executed on ${selectedDIIds.length} shipments.`, "success");
        setSelectedDIIds([]);
        setBulkStatus("");
        setBulkETD("");
        setBulkETA("");
        loadAllData();
      } else {
        showNotification("Failed to apply bulk updates. Try again.", "error");
      }
    } catch {
      showNotification("Error during bulk updates.", "error");
    } finally {
      setUpdatingBulk(false);
    }
  };

  // Save changes in Edit Drawer
  const handleSaveEdit = async () => {
    if (!editingDI) return;
    setSavingEdit(true);
    try {
      const updates = { ...editingDI };
      
      // Multi-day loading splits validation and synchronisation
      if (updates.loading_splits && updates.loading_splits.length > 0) {
        const totalSplitQty = updates.loading_splits.reduce((sum, s) => sum + s.qty, 0);
        const expectedQty = updates.container_qty || 1;
        
        if (totalSplitQty !== expectedQty) {
          showNotification(`Validation Error: Total split loading units (${totalSplitQty}) must exactly match grand total Cont. Qty (${expectedQty}).`, "error");
          setSavingEdit(false);
          return;
        }

        // Sort the splits by date to get min/max
        const validDates = updates.loading_splits
          .map(s => s.date)
          .filter(Boolean)
          .sort();
        
        if (validDates.length > 0) {
          updates.loading_start_date = validDates[0];
          updates.loading_end_date = validDates[validDates.length - 1];
          // Keep ETD date in sync with the start of loading
          updates.etd_date = validDates[0];
        }
      }

      // Document auto-fill helper to make it interactive!
      if (updates.status === "awaiting_bl_confirmation" && !updates.bl_draft_link) {
        updates.bl_draft_link = `https://example.com/drafts/bl-${updates.di_no.toLowerCase()}.pdf`;
        updates.bl_approval_status = "pending";
      }

      await updateShipment(editingDI.di_no, updates);
      showNotification(`Shipment ${editingDI.di_no} successfully updated.`, "success");
      setEditingDI(null);
      loadAllData();
    } catch {
      showNotification("Failed to update shipment records.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Create & Split PO submit
  const handleAddSplitRow = () => {
    const nextIdx = splitDIs.length + 1;
    const diSuffix = newPO.po_no ? `${newPO.po_no.replace("PO-", "DI-")}-${nextIdx}` : `DI-XXXX-${nextIdx}`;
    setSplitDIs(prev => [...prev, { di_no: diSuffix, product_id: "PROD-AUSTENITE-22", quantity_tons: 10.0 }]);
  };

  const handleRemoveSplitRow = (idx: number) => {
    setSplitDIs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSplitRowChange = (idx: number, field: string, value: string | number) => {
    setSplitDIs(prev => {
      const newRows = [...prev];
      newRows[idx] = { ...newRows[idx], [field]: value };
      return newRows;
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPO.po_no || !newPO.customer_id) {
      showNotification("Please provide a PO number and select a Customer.", "error");
      return;
    }

    setCreatingPO(true);

    const poRecord: PurchaseOrder = {
      po_no: newPO.po_no,
      customer_id: newPO.customer_id,
      po_date: newPO.po_date,
      total_amount_usd: Number(newPO.total_amount_usd),
      payment_term: newPO.payment_term,
      sales_person_id: newPO.sales_person_id
    };

    const shipmentsList: Shipment[] = splitDIs.map(row => ({
      di_no: row.di_no,
      po_no: newPO.po_no,
      status: "pending_production",
      product_id: row.product_id,
      quantity_tons: Number(row.quantity_tons),
      bl_approval_status: "pending",
      container_size: "40'",
      container_qty: 1,
      shipment_type: newPO.shipment_type
    }));

    try {
      const success = await createPurchaseOrder(poRecord, shipmentsList);
      if (success) {
        showNotification(`Order ${newPO.po_no} created and successfully split into ${splitDIs.length} DIs.`, "success");
        // Reset states
        setNewPO({
          po_no: "",
          customer_id: "",
          po_date: new Date().toISOString().split("T")[0],
          total_amount_usd: 0,
          payment_term: "30 Days Net",
          sales_person_id: "SALES-01",
          shipment_type: "container"
        });
        setSplitDIs([{ di_no: "DI-XXXX-1", product_id: "PROD-AUSTENITE-22", quantity_tons: 10.0 }]);
        setShowCreateForm(false);
        setActiveTab("logs");
        loadAllData();
      } else {
        showNotification("Failed to save PO. Verify if the PO number is unique.", "error");
      }
    } catch {
      showNotification("Error during PO creation.", "error");
    } finally {
      setCreatingPO(false);
    }
  };

  // Helper: auto-generate DI numbers when PO number is typed
  const handlePONumberChange = (poVal: string) => {
    setNewPO(prev => ({ ...prev, po_no: poVal }));
    setSplitDIs(prev => 
      prev.map((row, idx) => {
        const cleanPO = poVal.toUpperCase().replace(/\s+/g, "");
        const diNo = cleanPO ? `DI-${cleanPO.replace("PO-", "")}-${idx + 1}` : `DI-XXXX-${idx + 1}`;
        return { ...row, di_no: diNo };
      })
    );
  };

  // Real-time search and filter execution
  const getFilteredShipments = () => {
    return shipments.filter(ship => {
      // Find matching customer
      const parentPO = purchaseOrders.find(po => po.po_no === ship.po_no);
      const customer = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
      const customerName = customer ? customer.customer_name : "";

      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        ship.di_no.toLowerCase().includes(query) ||
        ship.po_no.toLowerCase().includes(query) ||
        ship.product_id.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query);

      const matchesCustomer = 
        selectedCustomerFilter === "all" || 
        (parentPO && parentPO.customer_id === selectedCustomerFilter);

      const matchesStatus = 
        selectedStatusFilter === "all" || 
        ship.status === selectedStatusFilter;

      const matchesType = 
        selectedShipmentTypeFilter === "all" || 
        ship.shipment_type === selectedShipmentTypeFilter ||
        (selectedShipmentTypeFilter === "container" && !ship.shipment_type);

      return matchesSearch && matchesCustomer && matchesStatus && matchesType;
    });
  };

  const filteredShipments = getFilteredShipments();

  // Metrics Calculations
  const stats = {
    totalShipments: shipments.length,
    activeDIs: shipments.filter(s => s.status !== "eta").length,
    completedDIs: shipments.filter(s => s.status === "eta").length,
    blAwaiting: shipments.filter(s => s.status === "awaiting_bl_confirmation").length,
    total20: shipments.reduce((sum, s) => sum + (s.container_size === "20'" ? (s.container_qty || 1) : 0), 0),
    total40: shipments.reduce((sum, s) => sum + ((s.container_size === "40'" || s.container_size === "40' HQ") ? (s.container_qty || 1) : 0), 0),
    totalContainers: shipments.reduce((sum, s) => sum + (s.container_qty || 1), 0)
  };

  const renderCalendarCell = (cellDate: Date, dateString: string, isCurrentMonth: boolean) => {
    // Find shipments active (loaded) on this day (Gantt style multi-day loading dates tracking)
    const dayShipments = shipments.filter(s => {
      const start = s.loading_start_date || s.etd_date;
      const end = s.loading_end_date || s.etd_date;
      if (!start) return false;
      return dateString >= start && dateString <= (end || start);
    });

    // Dynamic Heatmap loading sum logic (calculates sum of allocated containers on that day using specific splits if configured)
    const containersCount = dayShipments.reduce((sum, s) => {
      if (s.shipment_type === "bulk") return sum;
      let qty = s.container_qty || 1;
      if (s.loading_splits && s.loading_splits.length > 0) {
        const matchingSplit = s.loading_splits.find(sp => sp.date === dateString);
        if (matchingSplit) {
          qty = matchingSplit.qty;
        }
      }
      return sum + qty;
    }, 0);

    // Heatmap background color logic based on container counts
    let heatmapClass = "bg-slate-950/20"; // 0 containers (Neutral dark mode background)
    if (containersCount >= 1 && containersCount <= 5) {
      heatmapClass = "bg-emerald-950/30 text-emerald-300 border border-emerald-500/10";
    } else if (containersCount >= 6 && containersCount <= 10) {
      heatmapClass = "bg-yellow-950/40 text-yellow-300 border border-yellow-500/10";
    } else if (containersCount > 10) {
      heatmapClass = "bg-red-950/45 text-red-300 border border-red-500/20";
    }

    const isHovered = hoveredDay === dateString;

    return (
      <div
        key={dateString}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => {
          e.preventDefault();
          setHoveredDay(dateString);
        }}
        onDragLeave={() => {
          setHoveredDay(null);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setHoveredDay(null);
          
          const diNo = e.dataTransfer.getData("text/plain");
          const dragType = e.dataTransfer.getData("drag_type") || "shift_date";
          
          if (!diNo) return;
          
          try {
            const ship = shipments.find(s => s.di_no === diNo);
            if (!ship) return;
            
            const curStartStr = ship.loading_start_date || ship.etd_date || dateString;
            const curEndStr = ship.loading_end_date || ship.etd_date || dateString;
            const formatD = (d: Date) => d.toISOString().split("T")[0];
            
            if (dragType === "resize_start") {
              const newStart = dateString;
              if (newStart > curEndStr) {
                showNotification("Start date cannot be after end date", "error");
                return;
              }

              let updatedSplits = null;
              if (ship.loading_splits && ship.loading_splits.length > 0) {
                const sortedSplits = [...ship.loading_splits].sort((a, b) => a.date.localeCompare(b.date));
                if (sortedSplits.length > 0) {
                  sortedSplits[0].date = newStart;
                  updatedSplits = sortedSplits.filter(sp => sp.date <= curEndStr);
                }
              }

              await updateShipment(diNo, {
                etd_date: newStart,
                loading_start_date: newStart,
                loading_end_date: curEndStr,
                loading_splits: updatedSplits
              });
              showNotification(`Adjusted loading start date for ${diNo} to ${newStart}`, "success");
            } else if (dragType === "resize_end") {
              const newEnd = dateString;
              if (newEnd < curStartStr) {
                showNotification("End date cannot be before start date", "error");
                return;
              }

              let updatedSplits = null;
              if (ship.loading_splits && ship.loading_splits.length > 0) {
                const sortedSplits = [...ship.loading_splits].sort((a, b) => a.date.localeCompare(b.date));
                if (sortedSplits.length > 0) {
                  sortedSplits[sortedSplits.length - 1].date = newEnd;
                  updatedSplits = sortedSplits.filter(sp => sp.date >= curStartStr);
                }
              }

              await updateShipment(diNo, {
                loading_start_date: curStartStr,
                loading_end_date: newEnd,
                loading_splits: updatedSplits
              });
              showNotification(`Adjusted loading end date for ${diNo} to ${newEnd}`, "success");
            } else {
              const originalStart = e.dataTransfer.getData("start_date");
              
              if (!originalStart) {
                // Dragging from pool (1-day schedule default)
                await updateShipment(diNo, {
                  etd_date: dateString,
                  loading_start_date: dateString,
                  loading_end_date: dateString,
                  loading_splits: null // Reset to default single day schedule split
                });
                showNotification(`Shipment ${diNo} scheduled for loading on ${dateString}`, "success");
              } else {
                // Date Shifting (preserving multi-day length)
                const targetDate = new Date(dateString);
                const startDate = new Date(originalStart);
                const diffTime = targetDate.getTime() - startDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                const newStart = new Date(new Date(curStartStr).getTime() + diffDays * 86400000);
                const newEnd = new Date(new Date(curEndStr).getTime() + diffDays * 86400000);
                
                let updatedSplits = null;
                if (ship.loading_splits && ship.loading_splits.length > 0) {
                  updatedSplits = ship.loading_splits.map(sp => {
                    const spDate = new Date(sp.date);
                    const shiftedD = new Date(spDate.getTime() + diffDays * 86400000);
                    return { ...sp, date: formatD(shiftedD) };
                  });
                }

                await updateShipment(diNo, {
                  etd_date: formatD(newStart),
                  loading_start_date: formatD(newStart),
                  loading_end_date: formatD(newEnd),
                  loading_splits: updatedSplits
                });
                showNotification(`Shipment ${diNo} loading window shifted to ${formatD(newStart)} - ${formatD(newEnd)}`, "success");
              }
            }
            loadAllData();
          } catch {
            showNotification("Failed to reschedule shipment loading.", "error");
          }
        }}
        className={`min-h-[110px] p-2 transition-all flex flex-col justify-between ${heatmapClass} ${
          isCurrentMonth ? "" : "opacity-35"
        } ${isHovered ? "ring-2 ring-blue-500/80 ring-inset scale-[0.98] bg-blue-950/15" : ""}`}
      >
        {/* Date number */}
        <div className="flex items-center justify-between select-none">
          <span className={`text-[10px] font-bold ${isCurrentMonth ? "text-slate-400" : "text-slate-655"}`}>
            {cellDate.getDate()}
          </span>
          {containersCount > 0 && (
            <span className={`text-[8px] px-1.5 py-0.5 rounded ${
              containersCount > 10
                ? "bg-red-600 text-white font-extrabold border border-red-500 shadow-lg shadow-red-500/10"
                : "bg-slate-900 border border-slate-800 text-slate-300 font-bold"
            }`}>
              {containersCount} Load{containersCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Draggable DI cards inside the cell with Dynamic Lane Packing & Connections */}
        <div className="space-y-1.5 mt-2 flex-grow pr-0.5">
          {(() => {
            const elements: React.ReactNode[] = [];
            const dayLanesCount = dayShipments.reduce((max, s) => {
              const laneIdx = shipmentLanes.laneMap[s.di_no] ?? 0;
              return Math.max(max, laneIdx + 1);
            }, 0);

            for (let laneIdx = 0; laneIdx < dayLanesCount; laneIdx++) {
              const ship = dayShipments.find(s => shipmentLanes.laneMap[s.di_no] === laneIdx);
              if (ship) {
                const start = ship.loading_start_date || ship.etd_date || dateString;
                const end = ship.loading_end_date || ship.etd_date || dateString;
                const isStart = dateString === start;
                const isEnd = dateString === end;

                // Locate PO record to pull Customer Name
                const parentPO = purchaseOrders.find(po => po.po_no === ship.po_no);
                const cust = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
                const customerName = cust ? cust.customer_name : "Unknown Customer";

                // Clean Container Configuration (Format: Quantity x Size) - using specific daily split if configured
                let qty = ship.container_qty || 1;
                if (ship.loading_splits && ship.loading_splits.length > 0) {
                  const matchingSplit = ship.loading_splits.find(sp => sp.date === dateString);
                  if (matchingSplit) {
                    qty = matchingSplit.qty;
                  }
                }
                const size = ship.container_size || "40'";
                const cleanConfig = `${qty} x ${size}`;

                // horizontal continuous bar connect styles
                let spanClass = "rounded-xl border-slate-850 px-2";
                if (start < end) {
                  if (isStart) {
                    spanClass = "rounded-l-xl rounded-r-none border-y border-l border-r-0 pl-2 pr-1 mr-[-6px] relative z-10 border-blue-500/20";
                  } else if (isEnd) {
                    spanClass = "rounded-r-xl rounded-l-none border-y border-r border-l-0 pr-2 pl-1 ml-[-6px] relative z-10 border-blue-500/20";
                  } else {
                    spanClass = "rounded-none border-y border-x-0 px-1 mx-[-6px] relative z-0 border-blue-500/20";
                  }
                }

                elements.push(
                  <div
                    key={ship.di_no}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", ship.di_no);
                      e.dataTransfer.setData("drag_type", "shift_date");
                      e.dataTransfer.setData("start_date", start);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent trigger on day cell click
                      setSelectedCalendarDI(ship);
                    }}
                    className={`p-2 bg-slate-900 border text-left cursor-grab active:cursor-grabbing text-[9px] select-none hover:shadow-md hover:shadow-slate-950/30 transition-all group relative space-y-0.5 ${spanClass}`}
                  >
                    {/* Left Resize Handle */}
                    {isStart && (
                      <div
                        draggable="true"
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", ship.di_no);
                          e.dataTransfer.setData("drag_type", "resize_start");
                        }}
                        className="absolute left-0 top-0 bottom-0 w-1.5 hover:bg-blue-500/80 cursor-col-resize rounded-l-xl z-20 flex items-center justify-center text-[5px] text-white/50 select-none hover:text-white"
                      />
                    )}

                    {/* Right Resize Handle */}
                    {isEnd && (
                      <div
                        draggable="true"
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", ship.di_no);
                          e.dataTransfer.setData("drag_type", "resize_end");
                        }}
                        className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-blue-500/80 cursor-col-resize rounded-r-xl z-20 flex items-center justify-center text-[5px] text-white/50 select-none hover:text-white"
                      />
                    )}

                    {/* Line 1: DI Number and booking alert/checkmark */}
                    <div className="font-bold text-slate-100 group-hover:text-blue-400 transition-all leading-tight truncate flex items-center justify-between">
                      <span className="truncate flex items-center gap-1">
                        {ship.shipment_type === "bulk" && <span className="text-[10px] text-blue-400 shrink-0" title="Bulk Vessel">🚢</span>}
                        {ship.di_no}
                      </span>
                      {ship.booking_no ? (
                        <span className="text-[7px] text-emerald-400 shrink-0 animate-pulse" title={`Booking: ${ship.booking_no}`}>✅</span>
                      ) : (
                        <span className="text-[7px] text-amber-500 animate-pulse shrink-0" title="No Booking">⚠️</span>
                      )}
                    </div>

                    {/* Line 2: Customer Name */}
                    <span className="text-[8px] text-slate-400 block truncate font-medium leading-none">
                      {customerName}
                    </span>

                    {/* Line 3: Container spec and weight side-by-side */}
                    <div className="flex items-center justify-between text-[8px] font-semibold mt-0.5">
                      <span className="text-blue-300 font-bold leading-none">{cleanConfig}</span>
                      <span className="text-slate-500 font-normal leading-none">{Number(ship.quantity_tons).toFixed(1)} MT</span>
                    </div>
                  </div>
                );
              } else {
                elements.push(
                  <div
                    key={`placeholder-${laneIdx}`}
                    className="p-2 border border-transparent text-[9px] opacity-0 pointer-events-none select-none"
                    style={{ height: "46px" }}
                  >
                    <div className="font-bold leading-tight">&nbsp;</div>
                    <span className="text-[8px] block leading-none">&nbsp;</span>
                    <div className="flex items-center justify-between text-[8px] mt-0.5">
                      <span className="leading-none">&nbsp;</span>
                    </div>
                  </div>
                );
              }
            }

            return elements;
          })()}
        </div>
      </div>
    );
  };

  if (impersonatedShipment) {
    const parentPO = purchaseOrders.find(po => po.po_no === impersonatedShipment.po_no);
    const customer = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
    const customerName = customer ? customer.customer_name : "Apex Customer";

    const handleBLActionInPreview = async (action: "approve" | "reject") => {
      try {
        const feedbackText = blFeedback[impersonatedShipment.di_no] || "";
        const updates: Partial<Shipment> = {
          bl_approval_status: action === "approve" ? "approved" : "rejected",
          bl_feedback: feedbackText || (action === "approve" ? "Approved by client." : "Revision requested.")
        };

        if (action === "approve") {
          updates.status = "awaiting_all_docs";
          updates.shipping_docs_link = `https://example.com/docs/shipping-docs-${impersonatedShipment.di_no.toLowerCase()}.zip`;
        }

        await updateShipment(impersonatedShipment.di_no, updates);
        
        // Reload fresh state in admin view
        const freshShips = await getShipments();
        setShipments(freshShips);
        
        // Sync the impersonated shipment details
        const updatedShip = freshShips.find(s => s.di_no === impersonatedShipment.di_no);
        if (updatedShip) {
          setImpersonatedShipment(updatedShip);
        }
        
        setNotification({
          message: action === "approve" 
            ? `B/L Draft for ${impersonatedShipment.di_no} approved. Delivery status advanced.` 
            : `Amendment request for ${impersonatedShipment.di_no} submitted to logistics.`,
          type: "success"
        });
        setTimeout(() => setNotification(null), 4000);
      } catch {
        console.error("Error processing BL action");
      }
    };

    return (
      <div className="min-h-screen bg-slate-950 pb-20 text-slate-100 relative">
        {/* Toast Notification inside preview */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl glass-panel border border-blue-500/30 shadow-2xl flex items-center gap-3 animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
            <p className="text-xs text-white font-medium">{notification.message}</p>
          </div>
        )}

        {/* Amber Impersonation Mode Top Sticky Banner */}
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-500/30 px-6 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-sm font-bold text-amber-300 font-mono tracking-wide uppercase">
              Preview Mode: Viewing as {customerName}
            </span>
          </div>
          <button
            onClick={() => setImpersonatedShipment(null)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 bg-slate-900/80 hover:bg-slate-805 text-slate-300 hover:text-white rounded-lg border border-slate-750 transition-all text-xs font-semibold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Close Preview
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="max-w-4xl mx-auto px-6 mt-10 space-y-8 animate-fade-in">
          {/* Back button link */}
          <button 
            onClick={() => setImpersonatedShipment(null)}
            className="text-xs font-semibold text-slate-505 hover:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            &larr; Return to Global Shipment Log
          </button>

          {/* Client Card Title */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h2 className="text-xl font-bold text-white tracking-wide">Client Portal Interface Preview</h2>
            <span className="text-xs text-slate-400 font-mono">PO: {impersonatedShipment.po_no} &bull; {impersonatedShipment.di_no}</span>
          </div>

          {/* Core Card (Rendered exactly like Client Portal DI Card) */}
          <div className="p-6 rounded-3xl bg-slate-900/30 border border-slate-900 flex flex-col gap-6 relative shadow-2xl overflow-hidden glass-panel">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>

            {/* Shipment Header Details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{impersonatedShipment.di_no}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-blue-900/20 border border-blue-500/20 text-[10px] text-blue-400 font-semibold font-mono">
                    {impersonatedShipment.product_id}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Quantity: <strong>{Number(impersonatedShipment.quantity_tons).toFixed(3)} Tons</strong></span>
                  {impersonatedShipment.container_no && <span>Container: <strong>{impersonatedShipment.container_no}</strong></span>}
                  {impersonatedShipment.seal_no && <span>Seal: <strong>{impersonatedShipment.seal_no}</strong></span>}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-900 text-xs font-semibold text-slate-300 font-mono">
                  Status: <span className="text-blue-400 capitalize">{impersonatedShipment.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>

            {/* DUAL STEPPER SYSTEM */}
            <div className="py-6 border-y border-slate-900 bg-slate-950/20 px-6 rounded-2xl flex flex-col lg:flex-row justify-between gap-8 lg:gap-12 select-none">
              {/* Timeline 1: Vessel & Transit Tracking */}
              <div className="space-y-4 flex-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                  {impersonatedShipment.shipment_type === "domestic" ? "Physical Logistics Line" : "Vessel & Transit Tracking"}
                </div>
                {(() => {
                  const type = impersonatedShipment.shipment_type || "container";
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const shipStatus = impersonatedShipment.status || (impersonatedShipment as any).shipment_status;
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
                                        ? "text-[#1A2B49] dark:text-slate-300 font-semibold" 
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
                  {impersonatedShipment.shipment_type === "domestic" ? "Domestic Docs Clearance" : "Document Clearance Hub"}
                </div>
                {(() => {
                  const type = impersonatedShipment.shipment_type || "container";
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const shipStatus = impersonatedShipment.status || (impersonatedShipment as any).shipment_status;
                  const getDocActiveIndex = (s: Shipment | null, status: string) => {
                    if (!s) return 0;
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
                  const activeDocIndex = getDocActiveIndex(impersonatedShipment, shipStatus || "");
                  const docActiveStatus = impersonatedShipment.doc_status || (
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
                                        ? "text-[#1A2B49] dark:text-slate-300 font-semibold" 
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
              {/* Details list */}
              <div className="space-y-2 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3 font-mono">
                  <Info className="w-3.5 h-3.5 text-blue-400" /> Shipment Logistics Profile
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Forwarder Partner</span>
                    <span className="text-white font-medium">{impersonatedShipment.forwarder_id || "Awaiting Booking"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Vessel / Voyage</span>
                    <span className="text-white font-medium">{impersonatedShipment.vessel_voyage || "Not assigned"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estimated ETD</span>
                    <span className="text-white font-medium">{impersonatedShipment.etd_date || "Scheduling"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estimated ETA</span>
                    <span className="text-white font-medium">{impersonatedShipment.eta_date || "Scheduling"}</span>
                  </div>
                </div>
              </div>

              {/* Document Hub & B/L Action Module */}
              <div className="space-y-4">
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                  <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-3 font-mono">
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> Document Hub
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* B/L Draft Link */}
                    {impersonatedShipment.bl_draft_link ? (
                      <a 
                        href={impersonatedShipment.bl_draft_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400" />
                          <div>
                            <span className="text-xs text-white block font-medium">B/L Draft</span>
                            <span className="text-[9px] text-slate-500 block font-mono">PDF Document</span>
                          </div>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all" />
                      </a>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-955 flex items-center gap-2 text-slate-600">
                        <FileText className="w-4 h-4 text-slate-750" />
                        <div>
                          <span className="text-xs block font-medium">B/L Draft</span>
                          <span className="text-[9px] block">Not Available Yet</span>
                        </div>
                      </div>
                    )}

                    {/* Shipping Docs Link */}
                    {impersonatedShipment.shipping_docs_link ? (
                      <a 
                        href={impersonatedShipment.shipping_docs_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="text-xs text-white block font-medium">Shipping Dossier</span>
                            <span className="text-[9px] text-slate-500 block font-mono">All Files (.zip)</span>
                          </div>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all" />
                      </a>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-955 flex items-center gap-2 text-slate-600">
                        <FileText className="w-4 h-4 text-slate-750" />
                        <div>
                          <span className="text-xs block font-medium">Shipping Dossier</span>
                          <span className="text-[9px] block font-mono">Awaiting Dispatch</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* B/L Approval Console */}
                {impersonatedShipment.status === "awaiting_bl_confirmation" && (
                  <div className="glass-card p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/20"></div>
                    
                    <h6 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2 font-mono">
                      <AlertCircle className="w-4 h-4 text-amber-400" /> Customer Approval Action Required
                    </h6>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                      Please inspect the B/L draft and verify port codes, container weights, and product specifications.
                    </p>

                    {impersonatedShipment.bl_approval_status === "approved" ? (
                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>Draft Approved. Logistics preparing dispatch.</span>
                      </div>
                    ) : impersonatedShipment.bl_approval_status === "rejected" ? (
                      <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span>Amendment requested. Feedback logged: &quot;{impersonatedShipment.bl_feedback}&quot;</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Provide revision notes or feedback if requesting changes..."
                          value={blFeedback[impersonatedShipment.di_no] || ""}
                          onChange={(e) => setBlFeedback(prev => ({ ...prev, [impersonatedShipment.di_no]: e.target.value }))}
                          className="w-full p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all"
                          rows={2}
                        />

                        <div className="flex gap-2.5">
                          <button
                            onClick={() => handleBLActionInPreview("reject")}
                            className="flex-1 py-2 px-3 bg-red-950/30 border border-red-500/20 hover:bg-red-900/30 text-red-400 font-semibold rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            Request Revision
                          </button>
                          <button
                            onClick={() => handleBLActionInPreview("approve")}
                            className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer"
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Top Banner Header */}
      <header className="glass-panel border-b border-slate-900 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/10 animate-pulse">
              <FolderSync className="w-5 h-5 text-slate-950 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">WCAT Shipment Track</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                Logistics Command Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 py-1.5 px-3 rounded-full border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 font-semibold">Admin Panel</span>
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Toast Notifications */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl glass-panel border border-blue-500/30 shadow-2xl flex items-center gap-3 animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
            <p className="text-xs text-white font-medium">{notification.message}</p>
          </div>
        )}

        {/* Global Statistics Indicators */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 select-none">
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Global Shipments</span>
            <h3 className="text-xl font-bold text-white mt-1">{stats.totalShipments}</h3>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active DIs</span>
            <h3 className="text-xl font-bold text-white mt-1">{stats.activeDIs}</h3>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Completed (ETA)</span>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">{stats.completedDIs}</h3>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Awaiting B/L Confirm</span>
            <h3 className="text-xl font-bold text-amber-400 mt-1">{stats.blAwaiting}</h3>
          </div>
          {/* Card 1: Total 20' Containers */}
          <div className="glass-card rounded-2xl p-4 border border-blue-500/10">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total 20&apos; Cont.</span>
            <h3 className="text-xl font-bold text-blue-300 mt-1">{stats.total20}</h3>
          </div>
          {/* Card 2: Total 40' Containers */}
          <div className="glass-card rounded-2xl p-4 border border-blue-500/10">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total 40&apos;/HQ Cont.</span>
            <h3 className="text-xl font-bold text-cyan-300 mt-1">{stats.total40}</h3>
          </div>
          {/* Card 3: Total Containers */}
          <div className="glass-card rounded-2xl p-4 border border-blue-500/10 bg-gradient-to-br from-blue-950/20 to-slate-900/10">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Volume</span>
            <h3 className="text-xl font-bold mt-1 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{stats.totalContainers}</h3>
          </div>
        </section>

        {/* Workspace Tab Bar */}
        <div className="flex gap-2.5 border-b border-slate-900 pb-3 mb-6">
          <button
            onClick={() => setActiveTab("create")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "create" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            📄 PO Management
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "logs" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            📦 Global Shipment Log
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "calendar" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            📅 Logistics Calendar
          </button>

          <button
            onClick={() => setActiveTab("freight")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "freight" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            📈 Freight Price
          </button>

          <button
            onClick={() => setActiveTab("financial")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "financial" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            📊 Financial Command
          </button>

        </div>

        {/* ======================================================== */}
        {/* TAB 1: GLOBAL SHIPMENT LOG (TABLE, FILTER, BULK DRAWER)  */}
        {/* ======================================================== */}
        {activeTab === "logs" && (
          <section className="space-y-6">
            
            {/* Search & Filter bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-900/20 p-4 rounded-2xl border border-slate-900">
              {/* Fuzzy Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search DI, PO, Customer, Product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Customer Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedCustomerFilter}
                  onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">All Customers</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                  ))}
                </select>
              </div>

              {/* Shipment Type Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedShipmentTypeFilter}
                  onChange={(e) => setSelectedShipmentTypeFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">All Shipment Types</option>
                  <option value="container">Container</option>
                  <option value="bulk">Bulk Vessel</option>
                  <option value="domestic">Domestic</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white appearance-none focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="all">All Stages</option>
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* spreadsheet-like Data Grid */}
            <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                      <th className="py-4 px-5 w-10">
                        <input
                          type="checkbox"
                          checked={filteredShipments.length > 0 && filteredShipments.every(d => selectedDIIds.includes(d.di_no))}
                          onChange={() => toggleSelectAll(filteredShipments)}
                          className="rounded border-slate-850 text-blue-500 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                        />
                      </th>
                      <th className="py-4 px-3">INV</th>
                      <th className="py-4 px-3">DI No.</th>
                      <th className="py-4 px-3">PO Reference</th>
                      <th className="py-4 px-3">Customer Entity</th>
                      <th className="py-4 px-3">Product Info</th>
                      <th className="py-4 px-3">Quantity</th>
                      <th className="py-4 px-3">Shipment Types</th>
                      <th className="py-4 px-3">Current Pipeline Stage</th>
                      <th className="py-4 px-3 text-center">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-xs">
                    {filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          No shipments matching current filter constraints were detected.
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map(ship => {
                        const parentPO = purchaseOrders.find(po => po.po_no === ship.po_no);
                        const customer = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
                        const isSelected = selectedDIIds.includes(ship.di_no);

                        return (
                          <tr 
                            key={ship.di_no} 
                            className={`transition-all hover:bg-slate-900/10 ${
                              isSelected ? "bg-blue-500/5" : ""
                            }`}
                          >
                            <td className="py-3 px-5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectDI(ship.di_no)}
                                className="rounded border-slate-850 text-blue-500 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-300">{ship.invoice_no || "N/A"}</td>
                            <td className="py-3 px-3 font-bold text-white">{ship.di_no}</td>
                            <td className="py-3 px-3 text-slate-400 font-medium">{ship.po_no}</td>
                            <td className="py-3 px-3">
                              <div>
                                <div className="text-white font-medium">{customer?.customer_name || "Unknown"}</div>
                                <div className="text-[10px] text-slate-500">{customer?.country}</div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-blue-300">
                                {ship.product_id}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-white">
                              {Number(ship.quantity_tons).toFixed(3)}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-900 text-[10px] font-bold text-blue-300">
                                {ship.container_size || (
                                  ship.shipment_type === "bulk" ? "Bulk Vessel" :
                                  ship.shipment_type === "domestic" ? "Truck" : "40'"
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {(() => {
                                // 1. Determine shipment type
                                const shipType = ship.shipment_type || "container";
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const shipStatus = ship.status || (ship as any).shipment_status;

                                // 2. Physical active index (0 to 4)
                                const getPhysicalActiveIndex = (status: string) => {
                                  if (status === "pending_production") return 0;
                                  if (status === "pending_packaging") return 1;
                                  if (status === "awaiting_loading" || status === "loaded_into_container" || status === "awaiting_bl_confirmation" || status === "awaiting_all_docs") return 2;
                                  if (status === "etd") return 3;
                                  if (status === "eta") return 4;
                                  return 0;
                                };
                                const activePhysIdx = getPhysicalActiveIndex(shipStatus || "");
                                const isPhysPulse = shipStatus !== "eta";

                                // 3. Doc active index (0 to 4)
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
                                const activeDocIdx = getDocActiveIndex(ship, shipStatus || "");
                                
                                const isDocPulse = (ship.doc_status || "") !== "all_ship_docs_completed" && shipStatus !== "eta";

                                // 4. Define dynamic labels based on shipment type
                                let physLabels = ["Prod", "Pack", "Loaded", "ETD", "ETA"];
                                let docLabels = ["Book", "Prep", "BL", "Draft", "All Completed"];

                                if (shipType === "bulk") {
                                  physLabels = ["Production", "Barge Loading", "River Transit", "Sichang Anchorage", "Sailing (ETD/ETA)"];
                                  docLabels = ["PO Issued", "WH Weight", "Draft Docs", "All Ship Docs"];
                                } else if (shipType === "domestic") {
                                  physLabels = ["Production", "Queueing", "Delivered"];
                                  docLabels = ["PO Issued", "Delivery Order", "Invoice", "Paid"];
                                }

                                const clampedPhysIdx = Math.min(activePhysIdx, physLabels.length - 1);
                                const clampedDocIdx = Math.min(activeDocIdx, docLabels.length - 1);

                                // 5. Helper rendering methods
                                const renderPhysStage = (label: string, idx: number) => {
                                  const isActive = idx === clampedPhysIdx;
                                  return (
                                    <span className="flex items-center gap-1" key={idx}>
                                      <span className={`transition-all font-mono text-[9px] tracking-wide ${
                                        isActive 
                                          ? "text-emerald-400 font-bold" 
                                          : "text-slate-500 font-medium"
                                      }`}>
                                        {label}
                                      </span>
                                      {isActive && (
                                        isPhysPulse ? (
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                          </span>
                                        ) : (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                        )
                                      )}
                                    </span>
                                  );
                                };

                                const renderDocStage = (label: string, idx: number) => {
                                  const isActive = idx === clampedDocIdx;
                                  return (
                                    <span className="flex items-center gap-1" key={idx}>
                                      <span className={`transition-all font-mono text-[9px] tracking-wide ${
                                        isActive 
                                          ? "text-emerald-400 font-bold" 
                                          : "text-slate-500 font-medium"
                                      }`}>
                                        {label}
                                      </span>
                                      {isActive && (
                                        isDocPulse ? (
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                          </span>
                                        ) : (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                        )
                                      )}
                                    </span>
                                  );
                                };

                                return (
                                  <div className="flex flex-col space-y-1 min-w-[210px] pr-2 select-none">
                                    {/* Line 1: Shipment Status (Physical Tracking) */}
                                    <div className="flex items-center gap-1 text-[9px] text-slate-600 font-bold flex-wrap leading-none">
                                      {physLabels.map((lbl, i) => (
                                        <div className="flex items-center" key={i}>
                                          {renderPhysStage(lbl, i)}
                                          {i < physLabels.length - 1 && <span className="text-slate-800/80 font-normal mx-0.5">|</span>}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Divider */}
                                    <div className="h-[1px] bg-slate-900 border-t border-slate-800/30 w-full my-0.5" />

                                    {/* Line 2: Docs Status (Document Tracking) */}
                                    <div className="flex items-center gap-1 text-[9px] text-slate-600 font-bold flex-wrap leading-none">
                                      {docLabels.map((lbl, i) => (
                                        <div className="flex items-center" key={i}>
                                          {renderDocStage(lbl, i)}
                                          {i < docLabels.length - 1 && <span className="text-slate-800/80 font-normal mx-0.5">|</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setActiveModalTab("general");
                                    setEditingDI(ship);
                                  }}
                                  className="p-1.5 bg-slate-900/60 hover:bg-blue-600 hover:text-slate-950 text-slate-400 rounded-lg border border-slate-800 hover:border-transparent transition-all cursor-pointer"
                                  title="Edit Shipment Logistics"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setImpersonatedShipment(ship);
                                  }}
                                  className="p-1.5 bg-slate-900/60 hover:bg-emerald-600 hover:text-slate-950 text-slate-400 rounded-lg border border-slate-800 hover:border-transparent transition-all cursor-pointer"
                                  title="View as Customer (Impersonate)"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* spreadsheet Bulk update workspace (Checked checkboxes toggle) */}
            {selectedDIIds.length > 0 && (
              <div className="glass-panel p-5 rounded-2xl border border-blue-500/20 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 animate-fade-in">
                <div className="absolute top-0 left-0 w-2.5 h-full bg-blue-500"></div>
                
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-blue-400" /> Multi-Row Rapid Excel Logger Enabled
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    <strong>{selectedDIIds.length}</strong> shipment instruction(s) checked. Mass updates will be executed synchronously.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3.5">
                  {/* Status Dropdown */}
                  <div>
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Set Mass Status --</option>
                      {PIPELINE_STAGES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* ETD Date */}
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="date"
                      value={bulkETD}
                      onChange={(e) => setBulkETD(e.target.value)}
                      className="bg-transparent border-none text-xs text-slate-300 focus:outline-none"
                      title="Mass ETD Date"
                    />
                  </div>

                  {/* ETA Date */}
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="date"
                      value={bulkETA}
                      onChange={(e) => setBulkETA(e.target.value)}
                      className="bg-transparent border-none text-xs text-slate-300 focus:outline-none"
                      title="Mass ETA Date"
                    />
                  </div>

                  <button
                    onClick={handleBulkUpdate}
                    disabled={updatingBulk || (!bulkStatus && !bulkETD && !bulkETA)}
                    className="py-1.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    {updatingBulk ? "Applying..." : "Execute Mass Log Update"}
                  </button>

                  <button 
                    onClick={() => setSelectedDIIds([])}
                    className="text-xs text-slate-500 hover:text-white p-1"
                    title="Cancel Selection"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PO MANAGEMENT MASTER LEDGER & CREATION WORKSPACE  */}
        {/* ======================================================== */}
        {activeTab === "create" && (
          <div className="w-full animate-fade-in space-y-6">
            {!showCreateForm ? (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-xl max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-900 pb-4 mb-6 gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                      📄 Purchase Order Master Ledger
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                      Operational grid ledger displaying contracts & delivery progress allocations
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-500/10 flex items-center gap-1.5 font-sans"
                  >
                    <span>+ Log Purchase Order</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950/10">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4">PO Number</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Product</th>
                        <th className="py-3 px-3">Sign Date</th>
                        <th className="py-3 px-3 text-right">Total (MT)</th>
                        <th className="py-3 px-3 text-right">Total Value</th>
                        <th className="py-3 px-3 text-right">Remaining</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-xs font-sans text-slate-200">
                      {(() => {
                        const sortedPOs = [...purchaseOrders].sort((a, b) => b.po_date.localeCompare(a.po_date));
                        if (sortedPOs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-slate-500 font-bold uppercase tracking-wider">
                                No active Purchase Orders found. Click &quot;+ Log Purchase Order&quot; to add one.
                              </td>
                            </tr>
                          );
                        }
                        return sortedPOs.map((po) => {
                          const customer = customers.find(c => c.customer_id === po.customer_id);
                          const customerName = customer ? customer.customer_name : "Apex Logistics";
                          const totalTonnage = po.total_qty || 0;
                          const allocatedTonnage = shipments
                            .filter(s => s.po_no === po.po_no)
                            .reduce((sum, s) => sum + (Number(s.quantity_tons) || 0), 0);
                          const remainingTonnage = Math.max(0, totalTonnage - allocatedTonnage);
                          const progressPercent = totalTonnage > 0 ? ((totalTonnage - remainingTonnage) / totalTonnage) * 100 : 0;

                          let barColor = "bg-amber-500";
                          if (progressPercent >= 100) {
                            barColor = "bg-emerald-500";
                          } else if (progressPercent >= 30) {
                            barColor = "bg-blue-500";
                          }

                          const getCurrencySymbol = (curr?: string) => {
                            if (curr === "EUR") return "€";
                            if (curr === "THB") return "฿";
                            return "$";
                          };

                          const handleOpenSplitWizard = () => {
                            setSelectedPOForSplit(po);
                            const existingDIs = shipments.filter(s => s.po_no === po.po_no);
                            const nextIdx = existingDIs.length + 1;
                            const cleanPO = po.po_no.replace("PO-", "");
                            const diNo = `DI-${cleanPO}-${nextIdx}`;
                            setNewSplitRows([
                              {
                                di_no: diNo,
                                product_id: po.core_product || "PROD-AUSTENITE-22",
                                quantity_tons: 10.0
                              }
                            ]);
                          };

                          return (
                            <tr key={po.po_no} className="hover:bg-slate-900/10 transition-all">
                              {/* PO Number */}
                              <td className="py-3.5 px-4 font-bold font-mono">
                                <button
                                  type="button"
                                  onClick={handleOpenSplitWizard}
                                  className="text-blue-400 hover:text-blue-300 font-bold font-mono text-left focus:outline-none cursor-pointer"
                                >
                                  {po.po_no}
                                </button>
                              </td>

                              {/* Customer */}
                              <td className="py-3.5 px-3 font-semibold text-slate-300">
                                {customerName}
                              </td>

                              {/* Product */}
                              <td className="py-3.5 px-3 font-semibold text-slate-400">
                                {po.core_product || "Tapioca Flour Extra"}
                              </td>

                              {/* Sign Date */}
                              <td className="py-3.5 px-3 font-mono text-slate-400">
                                {po.po_date}
                              </td>

                              {/* Total (MT) */}
                              <td className="py-3.5 px-3 font-mono font-semibold text-right">
                                {Number(totalTonnage).toFixed(3)} MT
                              </td>

                              {/* Total Value */}
                              <td className="py-3.5 px-3 font-mono font-semibold text-right">
                                {getCurrencySymbol(po.currency)}{Number(po.total_amount_usd).toLocaleString()}
                              </td>

                              {/* Remaining */}
                              <td className="py-3.5 px-3 font-mono font-semibold text-right text-slate-400">
                                {Number(remainingTonnage).toFixed(3)} MT
                              </td>

                              {/* Status Progress Bar */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2 justify-center select-none">
                                  <div className="h-2 w-24 bg-slate-850 rounded-full overflow-hidden border border-slate-900">
                                    <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, progressPercent)}%` }}></div>
                                  </div>
                                  <span className="text-[10px] font-bold font-mono text-slate-400 w-10 text-right">
                                    {progressPercent.toFixed(1)}%
                                  </span>
                                </div>
                              </td>

                              {/* Action */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={handleOpenSplitWizard}
                                  className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-slate-950 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-1 mx-auto font-sans"
                                >
                                  Split DIs
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-xl max-w-4xl mx-auto">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-400" /> Log Purchase Order & Split DI Instruction Rows
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="py-1.5 px-3.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 cursor-pointer transition-all"
                  >
                    &larr; Back to PO Ledger
                  </button>
                </div>

                <form onSubmit={handleCreatePO} className="space-y-6">
                  {/* Form Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        PO No. (Unique identifier)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. WCAT-2601"
                        value={newPO.po_no}
                        onChange={(e) => handlePONumberChange(e.target.value)}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Assign Customer Entity
                      </label>
                      <select
                        required
                        value={newPO.customer_id}
                        onChange={(e) => setNewPO(prev => ({ ...prev, customer_id: e.target.value }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Choose Customer --</option>
                        {customers.map(c => (
                          <option key={c.customer_id} value={c.customer_id}>
                            {c.customer_name} ({c.customer_id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Shipment Type
                      </label>
                      <select
                        required
                        value={newPO.shipment_type}
                        onChange={(e) => setNewPO(prev => ({ ...prev, shipment_type: e.target.value as "container" | "bulk" | "domestic" }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="container">Container</option>
                        <option value="bulk">Bulk Vessel</option>
                        <option value="domestic">Domestic</option>
                      </select>
                    </div>
                  </div>

                  {/* Form Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        PO Sign Date
                      </label>
                      <input
                        type="date"
                        required
                        value={newPO.po_date}
                        onChange={(e) => setNewPO(prev => ({ ...prev, po_date: e.target.value }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Total Amount (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newPO.total_amount_usd}
                        onChange={(e) => setNewPO(prev => ({ ...prev, total_amount_usd: Number(e.target.value) }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Payment Terms
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 30 Days Net"
                        value={newPO.payment_term}
                        onChange={(e) => setNewPO(prev => ({ ...prev, payment_term: e.target.value }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Sales Agent ID
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SALES-04"
                        value={newPO.sales_person_id}
                        onChange={(e) => setNewPO(prev => ({ ...prev, sales_person_id: e.target.value }))}
                        className="w-full p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Dynamic Split DI Lines Table */}
                  <div className="border-t border-slate-900 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                        Instruction Split-Plan (Delivery Instructions - DIs)
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddSplitRow}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 text-blue-400 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add DI Line
                      </button>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-900 rounded-2xl overflow-hidden p-3 space-y-3">
                      {splitDIs.map((row, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-3.5 p-3.5 rounded-xl bg-slate-900/40 border border-slate-950">
                          
                          <div className="flex-1 w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              DI No.
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="DI No."
                              value={row.di_no}
                              onChange={(e) => handleSplitRowChange(idx, "di_no", e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none"
                            />
                          </div>

                          <div className="flex-1 w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Product Specifications ID
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. PROD-FERRITIC-11"
                              value={row.product_id}
                              onChange={(e) => handleSplitRowChange(idx, "product_id", e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none"
                            />
                          </div>

                          <div className="w-full sm:w-32">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Tons Quantity
                            </label>
                            <input
                              type="number"
                              required
                              min="0.001"
                              step="0.001"
                              placeholder="Tonnage"
                              value={row.quantity_tons}
                              onChange={(e) => handleSplitRowChange(idx, "quantity_tons", e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none"
                            />
                          </div>

                          {splitDIs.length > 1 && (
                            <div className="self-end pb-0.5 sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSplitRow(idx)}
                                className="p-2 text-red-400 bg-red-950/20 hover:bg-red-900/40 rounded-lg border border-red-500/10 cursor-pointer"
                                title="Remove split line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="border-t border-slate-900 pt-6 flex justify-end gap-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setSplitDIs([{ di_no: "DI-XXXX-1", product_id: "PROD-AUSTENITE-22", quantity_tons: 10.0 }]);
                      }}
                      className="py-3 px-6 bg-slate-900 hover:bg-slate-850 text-white font-semibold rounded-xl text-xs border border-slate-800 transition-all cursor-pointer"
                    >
                      Cancel & Reset
                    </button>
                    <button
                      type="submit"
                      disabled={creatingPO}
                      className="py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-500/15"
                    >
                      {creatingPO ? "Executing SPLIT Transaction..." : "Issue PO & Split Shipments"}
                    </button>
                  </div>
                </form>
              </section>
            )}
            
            {/* INTEGRATED POP-UP SPLIT DI WIZARD OVERLAY MODAL */}
            {selectedPOForSplit && (
              <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm transition-opacity">
                <div onClick={() => setSelectedPOForSplit(null)} className="absolute inset-0"></div>
                
                <div className="relative w-full max-w-3xl glass-panel rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 z-10 animate-scale-in animate-fade-in max-h-[90vh] overflow-y-auto">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <FolderSync className="w-5 h-5 text-blue-400 animate-spin [animation-duration:12s]" /> Split DI Wizard: {selectedPOForSplit.po_no}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-sans">
                        Manage and allocate delivery instruction splits for contract: {selectedPOForSplit.core_product || "Tapioca Flour"}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPOForSplit(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Upper Layer: Previous DI Splits History */}
                  <div className="space-y-3.5 mb-6">
                    <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider font-mono flex items-center gap-1 select-none">
                      <span>●</span> Layer 1: Previous DI Splits History Log
                    </h4>
                    
                    <div className="overflow-x-auto rounded-2xl border border-slate-900/60 bg-slate-950/20">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-900 bg-slate-950/40 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                            <th className="py-2.5 px-4">DI Number</th>
                            <th className="py-2.5 px-3">Product Specs ID</th>
                            <th className="py-2.5 px-3 text-right">Quantity (Tons)</th>
                            <th className="py-2.5 px-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/40 font-sans">
                          {shipments.filter(s => s.po_no === selectedPOForSplit.po_no).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-5 text-center text-slate-500 font-bold uppercase tracking-wider select-none">
                                No DI lines allocated yet for this Purchase Order.
                              </td>
                            </tr>
                          ) : (
                            shipments
                              .filter(s => s.po_no === selectedPOForSplit.po_no)
                              .map((ship, index) => (
                                <tr key={index} className="hover:bg-slate-900/5 transition-all text-slate-200">
                                  <td className="py-2.5 px-4 font-bold font-mono">{ship.di_no}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-400">{ship.product_id}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{Number(ship.quantity_tons || 0).toFixed(3)} MT</td>
                                  <td className="py-2.5 px-4 text-center">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-850 text-blue-400 capitalize text-[9px] font-bold">
                                      {ship.status.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lower Layer: Interactive advanced input form fields */}
                  <div className="space-y-4 border-t border-slate-900 pt-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono flex items-center gap-1 select-none">
                        <span>●</span> Layer 2: Allocate New DI Splits
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanPO = selectedPOForSplit.po_no.replace("PO-", "");
                          const existingCount = shipments.filter(s => s.po_no === selectedPOForSplit.po_no).length;
                          const nextIdx = existingCount + newSplitRows.length + 1;
                          const diNo = `DI-${cleanPO}-${nextIdx}`;
                          setNewSplitRows(prev => [...prev, {
                            di_no: diNo,
                            product_id: selectedPOForSplit.core_product || "PROD-AUSTENITE-22",
                            quantity_tons: 10.0
                          }]);
                        }}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 text-cyan-400 rounded-xl text-[10px] font-bold flex items-center gap-1 border border-slate-800 cursor-pointer transition-all font-sans"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Split Line
                      </button>
                    </div>

                    {newSplitRows.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/10 text-slate-500 font-bold uppercase tracking-wider select-none text-xs font-sans">
                        Click &quot;Add Split Line&quot; to configure a new DI shipment split.
                      </div>
                    ) : (
                      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-3.5 space-y-3">
                        {newSplitRows.map((row, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-slate-900/30 border border-slate-900">
                            
                            <div className="flex-1 w-full">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                                DI Number
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. DI-2601-A9"
                                value={row.di_no}
                                onChange={(e) => {
                                  const updated = [...newSplitRows];
                                  updated[idx].di_no = e.target.value;
                                  setNewSplitRows(updated);
                                }}
                                className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                              />
                            </div>

                            <div className="flex-1 w-full font-mono">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                                Product ID
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Product Spec ID"
                                value={row.product_id}
                                onChange={(e) => {
                                  const updated = [...newSplitRows];
                                  updated[idx].product_id = e.target.value;
                                  setNewSplitRows(updated);
                                }}
                                className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="w-full sm:w-32">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                                Quantity (Tons)
                              </label>
                              <input
                                type="number"
                                required
                                min="0.001"
                                step="0.001"
                                placeholder="Tons"
                                value={row.quantity_tons || ""}
                                onChange={(e) => {
                                  const updated = [...newSplitRows];
                                  updated[idx].quantity_tons = parseFloat(e.target.value) || 0;
                                  setNewSplitRows(updated);
                                }}
                                className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono text-right"
                              />
                            </div>

                            <div className="self-end pb-0.5 sm:self-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewSplitRows(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="p-2 text-red-400 bg-red-950/20 hover:bg-red-900/40 rounded-lg border border-red-500/10 cursor-pointer"
                                title="Remove split line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Allocation Summary & Action Buttons */}
                    <div className="border-t border-slate-900 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Real-time Tonnage Calculations */}
                      {(() => {
                        const totalTonnage = selectedPOForSplit.total_qty || 0;
                        const existingCount = shipments.filter(s => s.po_no === selectedPOForSplit.po_no);
                        const allocatedTonnage = existingCount.reduce((sum, s) => sum + (Number(s.quantity_tons) || 0), 0);
                        const remainingTonnage = Math.max(0, totalTonnage - allocatedTonnage);
                        const stagedTonnage = newSplitRows.reduce((sum, r) => sum + r.quantity_tons, 0);
                        const finalRemaining = Math.max(0, remainingTonnage - stagedTonnage);

                        return (
                          <div className="flex gap-4 text-[10px] font-mono font-bold uppercase tracking-wider select-none text-slate-400">
                            <div>
                              <span>Total:</span>
                              <span className="text-white ml-1">{totalTonnage.toFixed(3)} MT</span>
                            </div>
                            <div>
                              <span>Allocated:</span>
                              <span className="text-blue-400 ml-1">{allocatedTonnage.toFixed(3)} MT</span>
                            </div>
                            <div>
                              <span>Staged:</span>
                              <span className="text-cyan-400 ml-1">{stagedTonnage.toFixed(3)} MT</span>
                            </div>
                            <div>
                              <span>Remaining:</span>
                              <span className={`${finalRemaining === 0 ? "text-emerald-400" : "text-amber-400"} ml-1`}>
                                {finalRemaining.toFixed(3)} MT
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex gap-3 w-full sm:w-auto font-sans">
                        <button
                          type="button"
                          onClick={() => setSelectedPOForSplit(null)}
                          className="flex-1 sm:flex-initial py-2.5 px-5 bg-slate-900 hover:bg-slate-850 text-white font-semibold rounded-xl text-xs border border-slate-800 transition-all cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={newSplitRows.length === 0}
                          onClick={async () => {
                            // Commit DI splits logic!
                            if (newSplitRows.some(r => !r.di_no || !r.product_id || r.quantity_tons <= 0)) {
                              showNotification("Validation Error: All staged split lines must have a valid DI number, Product Specs ID, and Quantity > 0.", "error");
                              return;
                            }
                            
                            // Duplicate checks
                            const diNos = newSplitRows.map(r => r.di_no);
                            const hasDuplicates = diNos.some((no, i) => diNos.indexOf(no) !== i) || shipments.some(s => diNos.includes(s.di_no));
                            if (hasDuplicates) {
                              showNotification("Validation Error: Staged DI numbers must be unique and must not exist in previous records.", "error");
                              return;
                            }

                            // Build Shipment objects to save!
                            const newShipments: Shipment[] = newSplitRows.map(row => ({
                              di_no: row.di_no,
                              po_no: selectedPOForSplit.po_no,
                              status: "pending_production",
                              product_id: row.product_id,
                              quantity_tons: row.quantity_tons,
                              bl_approval_status: "pending",
                              container_size: "40'",
                              container_qty: 1,
                              shipment_type: selectedPOForSplit.currency === "THB" ? "domestic" : "container", // default matching currency
                              product_info: selectedPOForSplit.core_product || "Tapioca Flour Extra",
                              destination_country: "United States"
                            }));

                            try {
                              const success = await createShipments(newShipments);
                              if (success) {
                                showNotification(`Successfully allocated ${newShipments.length} new DI splits to contract ${selectedPOForSplit.po_no}.`, "success");
                                setSelectedPOForSplit(null);
                                loadAllData();
                              } else {
                                showNotification("Failed to save split lines. Please try again.", "error");
                              }
                            } catch {
                              showNotification("Failed to save split lines due to an system error.", "error");
                            }
                          }}
                          className="flex-1 sm:flex-initial py-2.5 px-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg text-center"
                        >
                          Commit DI Splits
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: INTERACTIVE LOGISTICS CALENDAR WORKSPACE         */}
        {/* ======================================================== */}
        {activeTab === "calendar" && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            
            {/* LEFT 9 COLS: CALENDAR GRID */}
            <div className="lg:col-span-9 space-y-6">
              
              {/* Calendar Control Ribbon */}
              <div className="flex items-center justify-between bg-slate-900/20 p-4 rounded-2xl border border-slate-900">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-400 animate-pulse" />
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Container Loading & Dispatch Schedule
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Drag shipments to reschedule loading dates (ETD)
                    </p>
                  </div>
                </div>

                {/* Month Picker Navigation */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                    }}
                    className="py-1 px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                    title="Previous Month"
                  >
                    &larr; Prev
                  </button>
                  <span className="text-xs font-bold text-white min-w-[120px] text-center uppercase tracking-widest bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-900 select-none">
                    {currentCalendarDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                    }}
                    className="py-1 px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                    title="Next Month"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>

              {/* Heatmap Legend */}
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 bg-slate-950/30 p-4 rounded-2xl border border-slate-900/60 uppercase tracking-wider select-none">
                <span>Daily Load Capacity Heatmap:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-900 block"></span>
                  <span>0 Containers (Neutral)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-950/30 border border-emerald-500/20 block"></span>
                  <span className="text-emerald-400">1 - 5 Loads (Normal)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-yellow-950/40 border border-yellow-500/20 block"></span>
                  <span className="text-yellow-400">6 - 10 Loads (Moderate Alert)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-red-600 border border-red-500 text-[9px] font-bold text-white block uppercase tracking-wider shadow-lg shadow-red-500/15">10+ Load</span>
                  <span className="text-red-400 font-extrabold uppercase tracking-wider">&gt; 10 Loads (Peak Alert)</span>
                </div>
              </div>

              {/* Calendar Month Grid */}
              <div className="glass-panel rounded-3xl overflow-hidden border border-slate-900 shadow-2xl">
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 border-b border-slate-900/80 bg-slate-950/40 text-center py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Month Days Grid Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-900/60 bg-slate-950/10 border-t border-slate-900">
                  {(() => {
                    const year = currentCalendarDate.getFullYear();
                    const month = currentCalendarDate.getMonth();
                    const firstDayIdx = new Date(year, month, 1).getDay();
                    const totalDays = new Date(year, month + 1, 0).getDate();

                    const formatDateStr = (d: Date) => {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const dayVal = String(d.getDate()).padStart(2, "0");
                      return `${y}-${m}-${dayVal}`;
                    };

                    const cells: React.ReactNode[] = [];

                    // Pad previous month days
                    const prevMonthDaysLimit = new Date(year, month, 0).getDate();
                    for (let i = firstDayIdx - 1; i >= 0; i--) {
                      const cellDate = new Date(year, month - 1, prevMonthDaysLimit - i);
                      const dStr = formatDateStr(cellDate);
                      cells.push(renderCalendarCell(cellDate, dStr, false));
                    }

                    // Populate current month days
                    for (let i = 1; i <= totalDays; i++) {
                      const cellDate = new Date(year, month, i);
                      const dStr = formatDateStr(cellDate);
                      cells.push(renderCalendarCell(cellDate, dStr, true));
                    }

                    // Pad remaining cells up to 42
                    const totalPaddingNeeded = 42 - cells.length;
                    for (let i = 1; i <= totalPaddingNeeded; i++) {
                      const cellDate = new Date(year, month + 1, i);
                      const dStr = formatDateStr(cellDate);
                      cells.push(renderCalendarCell(cellDate, dStr, false));
                    }

                    return cells;
                  })()}
                </div>
              </div>
            </div>

            {/* RIGHT 3 COLS: UNSCHEDULED POOL DRAWER */}
            <div className="lg:col-span-3 space-y-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-900 shadow-xl space-y-4">
                <div className="border-b border-slate-900 pb-3 select-none">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-amber-500" /> Unscheduled DIs Pool
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Drag card onto calendar day to schedule loading (ETD) date.
                  </p>
                </div>

                {/* Pool List */}
                <div 
                  className="space-y-3 max-h-[520px] overflow-y-auto pr-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const diNo = e.dataTransfer.getData("text/plain");
                    if (!diNo) return;
                    try {
                      // Dropping here clears ETD and loading dates!
                      await updateShipment(diNo, { 
                        etd_date: null,
                        loading_start_date: null,
                        loading_end_date: null,
                        loading_splits: null
                      });
                      showNotification(`Shipment ${diNo} returned to unscheduled pool.`, "success");
                      loadAllData();
                    } catch {
                      showNotification("Failed to unschedule shipment.", "error");
                    }
                  }}
                >
                  {shipments.filter(s => !s.etd_date).length === 0 ? (
                    <div className="text-center py-10 text-[11px] text-slate-655 font-semibold bg-slate-950/20 border border-slate-900 border-dashed rounded-2xl select-none">
                      No unscheduled shipments. All shipments are mapped to calendar timelines.
                    </div>
                  ) : (
                    shipments
                      .filter(s => !s.etd_date)
                      .map(ship => {
                        // Locate PO record to pull Customer Name
                        const parentPO = purchaseOrders.find(po => po.po_no === ship.po_no);
                        const cust = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
                        const customerName = cust ? cust.customer_name : "Unknown Customer";

                        // Clean Container Configuration (Format: Quantity x Size)
                        const qty = ship.container_qty || 1;
                        const size = ship.container_size || "40'";
                        const cleanConfig = `${qty} x ${size}`;

                        return (
                          <div
                            key={ship.di_no}
                            draggable="true"
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", ship.di_no);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => setSelectedCalendarDI(ship)}
                            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all select-none cursor-grab active:cursor-grabbing group hover:shadow-lg hover:shadow-slate-950/20 relative space-y-1.5"
                          >
                            {/* Line 1: DI Number and booking alert/checkmark */}
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-all leading-tight truncate">
                                {ship.di_no}
                              </span>
                              {ship.booking_no ? (
                                <span className="text-[9px] text-emerald-400 shrink-0 animate-pulse" title={`Booking: ${ship.booking_no}`}>✅</span>
                              ) : (
                                <span className="text-[9px] text-amber-500 animate-pulse shrink-0" title="No Booking">⚠️</span>
                              )}
                            </div>
                            
                            {/* Line 2: Customer Name */}
                            <span className="text-[10px] text-slate-400 block truncate font-medium leading-none">
                              {customerName}
                            </span>
                            
                            {/* Line 3: Container spec and weight side-by-side */}
                            <div className="flex items-center justify-between text-[10px] font-semibold mt-1">
                              <span className="text-blue-300 font-bold leading-none">{cleanConfig}</span>
                              <span className="text-slate-500 font-normal leading-none">{Number(ship.quantity_tons).toFixed(1)} MT</span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* QUICK VIEW POPUP MODAL */}
            {selectedCalendarDI && (
              <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity">
                <div 
                  onClick={() => setSelectedCalendarDI(null)}
                  className="absolute inset-0"
                ></div>

                <div className="relative w-full max-w-md glass-panel rounded-3xl border border-slate-800/80 shadow-2xl p-6 z-10 animate-scale-in animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <FolderSync className="w-4 h-4 text-blue-400 animate-spin [animation-duration:10s]" /> Shipment Details: {selectedCalendarDI.di_no}
                    </h3>
                    <button
                      onClick={() => setSelectedCalendarDI(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-300">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-slate-500 block">Purchase Order No</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.po_no}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Product Specification</span>
                        <span className="text-blue-300 font-semibold">{selectedCalendarDI.product_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Quantity (Tons)</span>
                        <span className="text-white font-semibold">{Number(selectedCalendarDI.quantity_tons).toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Current Status</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-blue-400 capitalize inline-block border border-slate-800 text-[10px] mt-0.5">
                          {selectedCalendarDI.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-3">
                      <span className="text-slate-500 block mb-1">Booking Confirmation</span>
                      {selectedCalendarDI.booking_no ? (
                        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 font-medium">
                          <span>✅ Confirmed Booking:</span>
                          <strong className="text-white font-semibold">{selectedCalendarDI.booking_no}</strong>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-400 font-medium animate-pulse">
                          <span>⚠️ No Booking Assigned</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 border-t border-slate-900 pt-3">
                      <div>
                        <span className="text-slate-500 block">Container No</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.container_no || "Not Loaded"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Forwarder Seal No</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.seal_no || "Not Loaded"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Forwarder Booking</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.forwarder_id || "Awaiting Booking"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Vessel / Voyage</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.vessel_voyage || "Unassigned"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 border-t border-slate-900 pt-3">
                      <div>
                        <span className="text-slate-500 block">Departure Date (ETD)</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.etd_date || "Scheduling"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Destination Date (ETA)</span>
                        <span className="text-white font-semibold">{selectedCalendarDI.eta_date || "Scheduling"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-4 mt-5 flex gap-2">
                    <button
                      onClick={() => setSelectedCalendarDI(null)}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-850 text-white font-semibold rounded-xl text-xs border border-slate-800 transition-all cursor-pointer text-center"
                    >
                      Close Detail
                    </button>
                    <button
                      onClick={() => {
                        const targetDI = selectedCalendarDI;
                        setSelectedCalendarDI(null);
                        setActiveModalTab("general");
                        setEditingDI(targetDI); // Opens our pre-existing Logistics drawer!
                      }}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg text-center"
                    >
                      Quick Edit Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 4: FREIGHT PRICE LOG & INTELLIGENCE SUBSYSTEM       */}
        {/* ======================================================== */}
        {activeTab === "freight" && (
          <section className="space-y-6 animate-fade-in font-sans">
            {/* Trend Analysis & Market Forecasting Dashboard Section */}
            <div className="bg-slate-900/20 p-6 rounded-3xl border border-slate-900 space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900/60">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Trend Analysis & Market Forecasting
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Interactive dual-line pricing corridor & volatility intelligence
                    </p>
                  </div>
                </div>

                {/* Interactive Selectors */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {/* Port Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Port:</span>
                    <select
                      value={selectedTrendPort}
                      onChange={(e) => setSelectedTrendPort(e.target.value)}
                      className="p-2 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="Qingdao">Qingdao</option>
                      <option value="Los Angeles">Los Angeles</option>
                      <option value="Rotterdam">Rotterdam</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Hamburg">Hamburg</option>
                      <option value="Shanghai">Shanghai</option>
                    </select>
                  </div>

                  {/* Mode Selector Segmented Buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode:</span>
                    <div className="flex rounded-xl bg-slate-950/50 p-0.5 border border-slate-850 h-[34px] items-center">
                      {(["20' CONT", "40' HQ", "Bulk Vessel"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedTrendMode(m)}
                          className={`h-[28px] px-3 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                            selectedTrendMode === m
                              ? "bg-blue-600 text-slate-950 font-extrabold shadow-sm"
                              : "text-slate-500 hover:text-slate-355"
                          }`}
                        >
                          {m === "Bulk Vessel" ? "Bulk" : m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart & Metrics Container Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                {/* Custom SVG Dual-Line Area Chart (Left Column, col-span-3) */}
                <div className="lg:col-span-3 bg-slate-950/20 p-4 rounded-2xl border border-slate-900/60 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none font-mono">
                    <span>Rate Corridor ($ / {selectedTrendMode === "Bulk Vessel" ? "MT" : "Unit"})</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 border-t border-dashed border-indigo-400 inline-block"></span> Market Index Benchmark
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-3 h-0.5 bg-emerald-450 inline-block"></span> WCAT Actual secured
                      </span>
                    </div>
                  </div>

                  {/* Responsive Chart Area */}
                  <div className="w-full h-[240px]">
                    <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none">
                      {/* Gradients Definitions */}
                      <defs>
                        <linearGradient id="marketAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="wcatAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* SVG Gridlines */}
                      {chartCoords.yTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1="50"
                            y1={tick.y}
                            x2="580"
                            y2={tick.y}
                            stroke="#1e293b"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x="40"
                            y={tick.y + 4}
                            textAnchor="end"
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            ${tick.val.toLocaleString()}
                          </text>
                        </g>
                      ))}

                      {/* Area Paths (Fills) */}
                      <path d={chartCoords.marketAreaPath} fill="url(#marketAreaGrad)" />
                      <path d={chartCoords.wcatAreaPath} fill="url(#wcatAreaGrad)" />

                      {/* Line Paths */}
                      <path
                        d={chartCoords.marketLinePath}
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <path
                        d={chartCoords.wcatLinePath}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Month labels (X-Axis Ticks) */}
                      {chartCoords.points.map((p, i) => (
                        <g key={i}>
                          <line
                            x1={p.x}
                            y1="210"
                            x2={p.x}
                            y2="214"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          <text
                            x={p.x}
                            y="226"
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {p.month}
                          </text>

                          {/* Dynamic interactive node circle markers */}
                          <circle
                            cx={p.x}
                            cy={p.yMarket}
                            r="3"
                            fill="#818cf8"
                            stroke="#0f172a"
                            strokeWidth="1"
                          />
                          <circle
                            cx={p.x}
                            cy={p.yWcat}
                            r="4.5"
                            fill="#34d399"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Metric cards (Right Column, col-span-1) */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full h-full justify-between">
                  {/* Card 1: Avg Annual Savings */}
                  <div className="flex-1 bg-slate-950/30 p-5 rounded-2xl border border-slate-900/60 flex flex-col justify-center relative overflow-hidden group hover:border-slate-800 transition-all">
                    <div className="absolute top-0 right-0 p-3 text-lg opacity-10 group-hover:scale-110 transition-transform">
                      🟢
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Avg. Annual Saving
                    </span>
                    <div className="flex items-baseline gap-1 mt-2.5">
                      {/* Calculate saving dynamically */}
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        ${Math.round(trendData.reduce((acc, curr) => acc + curr.saving, 0) / 12).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        / {selectedTrendMode === "Bulk Vessel" ? "MT" : "Unit"}
                      </span>
                    </div>
                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1">
                      <span>✦</span> Dynamic pricing variance corridor
                    </p>
                  </div>

                  {/* Card 2: Price Volatility Index */}
                  <div className="flex-1 bg-slate-950/30 p-5 rounded-2xl border border-slate-900/60 flex flex-col justify-center relative overflow-hidden group hover:border-slate-800 transition-all">
                    <div className="absolute top-0 right-0 p-3 text-lg opacity-10 group-hover:scale-110 transition-transform">
                      ⚠️
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Price Volatility Index
                    </span>
                    <div className="flex items-baseline gap-1 mt-2.5">
                      {/* Calculate volatility dynamically */}
                      <span className="text-3xl font-extrabold text-blue-400 tracking-tight">
                        {Math.min(...trendData.slice(6).map(d => d.market)) > 0 ? (
                          Math.round(((Math.max(...trendData.slice(6).map(d => d.market)) - Math.min(...trendData.slice(6).map(d => d.market))) / Math.min(...trendData.slice(6).map(d => d.market))) * 100)
                        ) : 0}%
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1 font-sans">
                      <span>✦</span> 6-month historical bandwidth
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SUBTAB NAVIGATION */}
            <div className="flex border-b border-slate-900 gap-6 mb-6">
              <button 
                onClick={() => setFreightSubTab("market")}
                className={`pb-3 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                  freightSubTab === "market"
                    ? "border-blue-500 text-blue-400 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <span>📈</span> Market Index Manager (Monthly Averages)
              </button>
              <button 
                onClick={() => setFreightSubTab("bookings")}
                className={`pb-3 px-1 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                  freightSubTab === "bookings"
                    ? "border-blue-500 text-blue-400 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <span>📦</span> Actual Booking Variance Tracker (WCAT Live)
              </button>
            </div>

            {/* TAB 1: Market Index Manager (Monthly Averages) */}
            {freightSubTab === "market" && (
              <div className="space-y-6">
                {/* Logger Form */}
                <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-900 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-900/60">
                    <span className="text-blue-400 text-sm">📈</span>
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        Market Index Baseline Logger
                      </h2>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                        Log monthly baseline average freight rates as static reference benchmarks
                      </p>
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!marketForm.destinationPort || !marketForm.marketRate) {
                        alert("Please fill in all fields.");
                        return;
                      }
                      const newIndex: MarketIndex = {
                        id: Date.now().toString(),
                        monthYear: marketForm.monthYear,
                        period: marketForm.period,
                        destinationPort: marketForm.destinationPort,
                        mode: marketForm.mode,
                        marketRate: parseFloat(marketForm.marketRate)
                      };
                      setMarketIndexes([newIndex, ...marketIndexes]);
                      setMarketForm({
                        monthYear: marketForm.monthYear,
                        period: marketForm.period,
                        destinationPort: "",
                        mode: "20' CONT",
                        marketRate: ""
                      });
                    }}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end text-xs"
                  >
                    {/* Month/Year */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Month / Year
                      </label>
                      <select
                        value={marketForm.monthYear}
                        onChange={(e) => setMarketForm({ ...marketForm, monthYear: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="May 2026">May 2026</option>
                        <option value="June 2026">June 2026</option>
                        <option value="July 2026">July 2026</option>
                        <option value="August 2026">August 2026</option>
                      </select>
                    </div>

                    {/* Rate Period */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Rate Period
                      </label>
                      <select
                        value={marketForm.period}
                        onChange={(e) => setMarketForm({ ...marketForm, period: e.target.value as "1st Half" | "2nd Half" })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="1st Half">1st Half (Days 1-15)</option>
                        <option value="2nd Half">2nd Half (Days 16-End)</option>
                      </select>
                    </div>

                    {/* Destination Port */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Destination Port
                      </label>
                      <select
                        value={marketForm.destinationPort}
                        onChange={(e) => setMarketForm({ ...marketForm, destinationPort: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="">-- Select Port --</option>
                        <option value="Qingdao">Qingdao</option>
                        <option value="Los Angeles">Los Angeles</option>
                        <option value="Rotterdam">Rotterdam</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Hamburg">Hamburg</option>
                        <option value="Shanghai">Shanghai</option>
                      </select>
                    </div>

                    {/* Logistics Mode */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Logistics Mode
                      </label>
                      <div className="flex rounded-xl bg-slate-950/50 p-0.5 border border-slate-850 h-[38px] items-center">
                        {(["20' CONT", "40' HQ", "Bulk Vessel"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMarketForm({ ...marketForm, mode: m })}
                            className={`flex-1 h-[32px] px-2 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                              marketForm.mode === m
                                ? "bg-blue-600 text-slate-950 font-extrabold shadow-sm"
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {m === "Bulk Vessel" ? "Bulk" : m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Market Average Rate ($) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Market Average Rate ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 1000"
                        value={marketForm.marketRate}
                        onChange={(e) => setMarketForm({ ...marketForm, marketRate: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 h-[38px] bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1 font-sans"
                      >
                        <span>+ Add Market Index</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Reference Grid */}
                <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
                  <div className="p-4 bg-slate-950/40 border-b border-slate-900 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Monthly Baseline Market Averages
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {marketIndexes.length} Indices
                    </span>
                  </div>
                  <div className="overflow-x-auto font-sans">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none font-mono">
                          <th className="py-4 px-5">MONTH & YEAR</th>
                          <th className="py-4 px-3">RATE PERIOD</th>
                          <th className="py-4 px-3">DESTINATION PORT</th>
                          <th className="py-4 px-3">LOGISTICS MODE</th>
                          <th className="py-4 px-3">MARKET AVERAGE RATE ($)</th>
                          <th className="py-4 px-3 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-xs font-mono">
                        {marketIndexes.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                              No market indices logged yet.
                            </td>
                          </tr>
                        ) : (
                          marketIndexes.map((idx) => (
                            <tr key={idx.id} className="hover:bg-slate-900/10 transition-all text-slate-300">
                              <td className="py-3.5 px-5 font-bold text-white">{idx.monthYear}</td>
                              <td className="py-3.5 px-3">
                                <span className={`px-2.5 py-0.5 rounded text-[9px] font-extrabold ${
                                  idx.period === "1st Half"
                                    ? "bg-cyan-950/45 border border-cyan-500/20 text-cyan-400"
                                    : "bg-purple-950/45 border border-purple-500/20 text-purple-400"
                                }`}>
                                  {idx.period}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-semibold text-slate-200">{idx.destinationPort}</td>
                              <td className="py-3.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-blue-300">
                                  {idx.mode}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-bold text-cyan-400">${idx.marketRate.toLocaleString()}</td>
                              <td className="py-3.5 px-3 text-center">
                                <button
                                  onClick={() => setMarketIndexes(marketIndexes.filter(m => m.id !== idx.id))}
                                  className="text-red-400 hover:text-red-300 cursor-pointer transition-all p-1"
                                  title="Delete index"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Actual Booking Variance Tracker (WCAT Live) */}
            {freightSubTab === "bookings" && (
              <div className="space-y-6">
                {/* WCAT Rate Logger Form */}
                <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-900 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-900/60">
                    <span className="text-blue-400 text-sm">📦</span>
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        WCAT Live Booking Logger
                      </h2>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                        Log contract rates for active shipments and compare against baseline averages
                      </p>
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!bookingForm.diNumber || !bookingForm.destinationPort || !bookingForm.forwarderPartner || !bookingForm.wcatRate || !bookingForm.bookingDate) {
                        alert("Please fill in all fields.");
                        return;
                      }

                      // Resolve the target month based on Booking Date
                      const bookingDateObj = new Date(bookingForm.bookingDate);
                      let targetMonth = "May 2026";
                      if (!isNaN(bookingDateObj.getTime())) {
                        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                        targetMonth = `${months[bookingDateObj.getMonth()]} ${bookingDateObj.getFullYear()}`;
                      }

                      const newBooking: ActualBooking = {
                        id: Date.now().toString(),
                        diNumber: bookingForm.diNumber,
                        destinationPort: bookingForm.destinationPort,
                        mode: bookingForm.mode,
                        forwarderPartner: bookingForm.forwarderPartner,
                        wcatRate: parseFloat(bookingForm.wcatRate),
                        bookingDate: bookingForm.bookingDate,
                        targetMonth
                      };
                      
                      setActualBookings([newBooking, ...actualBookings]);
                      setBookingForm({
                        diNumber: "",
                        destinationPort: "",
                        mode: "20' CONT",
                        forwarderPartner: "",
                        wcatRate: "",
                        bookingDate: ""
                      });
                    }}
                    className="grid grid-cols-1 sm:grid-cols-7 gap-4 items-end text-xs"
                  >
                    {/* DI Number */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        DI Number
                      </label>
                      <select
                        value={bookingForm.diNumber}
                        onChange={(e) => {
                          const di = e.target.value;
                          const ship = shipments.find(s => s.di_no === di);
                          if (ship) {
                            let resolvedPort = "";
                            if (ship.destination_country === "United States") resolvedPort = "Los Angeles";
                            else if (ship.destination_country === "Germany" || ship.destination_country === "Netherlands") resolvedPort = "Rotterdam";
                            else if (ship.destination_country === "Singapore") resolvedPort = "Singapore";
                            else if (ship.destination_country === "China") resolvedPort = "Shanghai";
                            else if (ship.destination_country === "Japan") resolvedPort = "Qingdao";
                            
                            let resolvedMode: "20' CONT" | "40' HQ" | "Bulk Vessel" = "20' CONT";
                            if (ship.container_size === "40' HQ" || ship.container_size === "40'") resolvedMode = "40' HQ";
                            else if (ship.shipment_type === "bulk") resolvedMode = "Bulk Vessel";

                            setBookingForm({
                              ...bookingForm,
                              diNumber: di,
                              destinationPort: resolvedPort || bookingForm.destinationPort,
                              mode: resolvedMode,
                              forwarderPartner: ship.forwarder_id || bookingForm.forwarderPartner,
                              bookingDate: ship.etd_date || ""
                            });
                          } else {
                            setBookingForm({ ...bookingForm, diNumber: di });
                          }
                        }}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
                      >
                        <option value="">-- Select DI --</option>
                        {shipments.map(s => (
                          <option key={s.di_no} value={s.di_no}>{s.di_no} ({s.product_info || "Shipment"})</option>
                        ))}
                      </select>
                    </div>

                    {/* Booking Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Booking Date
                      </label>
                      <input
                        type="date"
                        value={bookingForm.bookingDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, bookingDate: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      />
                    </div>

                    {/* Destination Port */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Destination Port
                      </label>
                      <select
                        value={bookingForm.destinationPort}
                        onChange={(e) => setBookingForm({ ...bookingForm, destinationPort: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="">-- Select Port --</option>
                        <option value="Qingdao">Qingdao</option>
                        <option value="Los Angeles">Los Angeles</option>
                        <option value="Rotterdam">Rotterdam</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Hamburg">Hamburg</option>
                        <option value="Shanghai">Shanghai</option>
                      </select>
                    </div>

                    {/* Logistics Mode */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Logistics Mode
                      </label>
                      <div className="flex rounded-xl bg-slate-950/50 p-0.5 border border-slate-850 h-[38px] items-center">
                        {(["20' CONT", "40' HQ", "Bulk Vessel"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, mode: m })}
                            className={`flex-1 h-[32px] px-2 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                              bookingForm.mode === m
                                ? "bg-blue-600 text-slate-950 font-extrabold shadow-sm"
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {m === "Bulk Vessel" ? "Bulk" : m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Forwarder Partner */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Forwarder Partner
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. OOCL"
                        value={bookingForm.forwarderPartner}
                        onChange={(e) => setBookingForm({ ...bookingForm, forwarderPartner: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* WCAT Actual Rate ($) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        WCAT Actual Rate ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 950"
                        value={bookingForm.wcatRate}
                        onChange={(e) => setBookingForm({ ...bookingForm, wcatRate: e.target.value })}
                        className="w-full p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 h-[38px] bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1 font-sans"
                      >
                        <span>+ Log Booking</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* dynamic ledger displaying active WCAT shipment logs */}
                <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
                  <div className="p-4 bg-slate-950/40 border-b border-slate-900 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      WCAT Actual Booking Ledger & Intelligence
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {actualBookings.length} Active Records
                    </span>
                  </div>
                  <div className="overflow-x-auto font-sans">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none font-mono">
                          <th className="py-4 px-5">DI NUMBER & PORT</th>
                          <th className="py-4 px-3">BOOKING DATE</th>
                          <th className="py-4 px-3">RATE PERIOD</th>
                          <th className="py-4 px-3">MODE</th>
                          <th className="py-4 px-3">FORWARDER</th>
                          <th className="py-4 px-3">WCAT ACTUAL RATE</th>
                          <th className="py-4 px-3">MARKET AVERAGE RATE</th>
                          <th className="py-4 px-3">FREIGHT VARIANCE ($/UNIT)</th>
                          <th className="py-4 px-3 text-center font-mono">QUOTE ADVANTAGE TAG</th>
                          <th className="py-4 px-3 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-xs font-mono">
                        {actualBookings.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-12 text-center text-slate-500 font-medium">
                              No logged actual bookings detected.
                            </td>
                          </tr>
                        ) : (
                          actualBookings.map((booking) => {
                            // 1. Resolve Target Month and rate period from Booking Date
                            let targetMonth = booking.targetMonth;
                            let ratePeriod: "1st Half" | "2nd Half" = "1st Half";
                            const bDate = new Date(booking.bookingDate || "2026-05-24");
                            if (!isNaN(bDate.getTime())) {
                              const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                              targetMonth = `${months[bDate.getMonth()]} ${bDate.getFullYear()}`;
                              ratePeriod = bDate.getDate() <= 15 ? "1st Half" : "2nd Half";
                            } else {
                              targetMonth = "May 2026";
                            }

                            // 2. Scan Market Index table using composite key [targetMonth + period + destinationPort + mode]
                            const match = marketIndexes.find(
                              (mi) =>
                                mi.monthYear === targetMonth &&
                                mi.period === ratePeriod &&
                                mi.destinationPort.toLowerCase() === booking.destinationPort.toLowerCase() &&
                                mi.mode === booking.mode
                            );

                            const marketRate = match ? match.marketRate : null;
                            const variance = marketRate !== null ? marketRate - booking.wcatRate : null;
                            const unitSuffix = booking.mode === "Bulk Vessel" ? "MT" : "Unit";

                            return (
                              <tr key={booking.id} className="hover:bg-slate-900/10 transition-all">
                                {/* DI NUMBER & PORT */}
                                <td className="py-3.5 px-5 font-sans">
                                  <div className="font-bold text-white">{booking.diNumber}</div>
                                  <div className="text-[9px] text-slate-500 mt-0.5">{booking.destinationPort}</div>
                                </td>

                                {/* BOOKING DATE */}
                                <td className="py-3.5 px-3 font-semibold text-slate-300 font-sans">
                                  {booking.bookingDate}
                                </td>

                                {/* RATE PERIOD */}
                                <td className="py-3.5 px-3">
                                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-extrabold ${
                                    ratePeriod === "1st Half"
                                      ? "bg-cyan-950/45 border border-cyan-500/20 text-cyan-400"
                                      : "bg-purple-950/45 border border-purple-500/20 text-purple-400"
                                  }`}>
                                    {ratePeriod}
                                  </span>
                                </td>

                                {/* MODE */}
                                <td className="py-3.5 px-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-blue-300">
                                    {booking.mode}
                                  </span>
                                </td>

                                {/* FORWARDER PARTNER */}
                                <td className="py-3.5 px-3 font-semibold text-slate-300 font-sans">
                                  {booking.forwarderPartner}
                                </td>

                                {/* WCAT ACTUAL RATE */}
                                <td className="py-3.5 px-3 font-bold text-white">
                                  ${booking.wcatRate.toLocaleString()}
                                </td>

                                {/* MARKET AVERAGE RATE */}
                                <td className="py-3.5 px-3 font-semibold text-slate-450">
                                  {marketRate !== null ? (
                                    `$${marketRate.toLocaleString()}`
                                  ) : (
                                    <span className="text-slate-600 font-sans text-[10px]">No {ratePeriod} Index</span>
                                  )}
                                </td>

                                {/* FREIGHT VARIANCE */}
                                <td className="py-3.5 px-3 font-bold text-xs">
                                  {variance === null ? (
                                    <span className="text-slate-650">N/A</span>
                                  ) : variance > 0 ? (
                                    <span className="text-emerald-450 font-bold">
                                      ▼ ${Math.abs(variance).toFixed(2)} / {unitSuffix}
                                    </span>
                                  ) : variance < 0 ? (
                                    <span className="text-red-405 font-bold">
                                      ▲ ${Math.abs(variance).toFixed(2)} / {unitSuffix}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      $0.00 / {unitSuffix}
                                    </span>
                                  )}
                                </td>

                                {/* QUOTE ADVANTAGE TAG */}
                                <td className="py-3.5 px-3 text-center">
                                  {variance === null ? (
                                    <span className="px-2.5 py-0.5 rounded bg-slate-950/45 border border-slate-800 text-[9px] font-extrabold text-slate-500 inline-block font-sans">
                                      ⚠️ NO INDEX
                                    </span>
                                  ) : variance > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded bg-emerald-950/45 border border-emerald-500/20 text-[9px] font-extrabold text-emerald-450 inline-block font-sans">
                                      🟢 SAVING
                                    </span>
                                  ) : variance < 0 ? (
                                    <span className="px-2.5 py-0.5 rounded bg-red-950/45 border border-red-500/20 text-[9px] font-extrabold text-red-400 inline-block font-sans">
                                      🔴 OVER BUDGET
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-extrabold text-slate-400 inline-block font-sans">
                                      🟡 STANDARD RATE
                                    </span>
                                  )}
                                </td>

                                {/* DELETE ACTION */}
                                <td className="py-3.5 px-3 text-center">
                                  <button
                                    onClick={() => setActualBookings(actualBookings.filter(b => b.id !== booking.id))}
                                    className="text-red-400 hover:text-red-300 cursor-pointer transition-all p-1"
                                    title="Delete booking"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 5: FINANCIAL COMMAND CENTER SUBSYSTEM                 */}
        {/* ======================================================== */}
        {activeTab === "financial" && (
          <section className="space-y-6 animate-fade-in font-sans">
            {/* OVERVIEW METRIC CARDS BANNER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Total Gross Revenue */}
              <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-900 relative overflow-hidden group hover:border-slate-800 transition-all flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Total Gross Revenue (THB)
                </span>
                <div className="text-3xl font-extrabold text-white tracking-tight mt-2.5">
                  ฿{financialLogs.reduce((acc, curr) => acc + curr.revenue, 0).toLocaleString()}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1">
                  <span>✦</span> Total value of all product invoices
                </p>
              </div>

              {/* Card 2: Total Shipment Expenses */}
              <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-900 relative overflow-hidden group hover:border-slate-800 transition-all flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Total Shipment Expenses (THB)
                </span>
                <div className="text-3xl font-extrabold text-slate-455 tracking-tight mt-2.5">
                  ฿{financialLogs.reduce((acc, curr) => acc + getShipmentCostDetails(curr).totalCosts, 0).toLocaleString()}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1">
                  <span>✦</span> Logistics, penalties & matched freight
                </p>
              </div>

              {/* Card 3: WCAT Net Profit & Margin */}
              {(() => {
                const totalRev = financialLogs.reduce((acc, curr) => acc + curr.revenue, 0);
                const totalExp = financialLogs.reduce((acc, curr) => acc + getShipmentCostDetails(curr).totalCosts, 0);
                const netProf = totalRev - totalExp;
                const margPerc = totalRev > 0 ? Math.round((netProf / totalRev) * 100) : 0;
                const isProf = netProf >= 0;

                return (
                  <div className={`p-5 rounded-3xl border relative overflow-hidden transition-all flex flex-col justify-center ${
                    isProf 
                      ? "bg-emerald-950/10 border-emerald-900/40" 
                      : "bg-red-950/10 border-red-900/40"
                  }`}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      WCAT Net Profit & Margin (THB)
                    </span>
                    <div className={`text-3xl font-extrabold tracking-tight mt-2.5 ${
                      isProf ? "text-emerald-450" : "text-red-400"
                    }`}>
                      {isProf ? "" : "-"}฿{Math.abs(netProf).toLocaleString()}
                      <span className="text-sm font-semibold ml-1.5 opacity-90">({margPerc}%)</span>
                    </div>
                    <p className={`text-[9px] font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1 ${
                      isProf ? "text-emerald-400" : "text-red-450"
                    }`}>
                      <span>✦</span> {isProf ? "🟢 Profitable margin corridor" : "🔴 Operational budget breach"}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* DYNAMIC COST LOGGER & TREND CHART GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900/20 p-6 rounded-3xl border border-slate-900 space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-900/60">
                  <span className="text-blue-400 text-sm">📊</span>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Shipment Financial Logger & Cost Control
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Log dynamic WCAT clearing expenses row-by-row with real-time formulas
                    </p>
                  </div>
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!financialForm.diNumber) {
                      alert("Please select a DI number.");
                      return;
                    }

                    // Map row strings back to numbers
                    const savedRows: CostRow[] = financialForm.costRows.map(row => ({
                      item: row.item,
                      supplier: row.supplier,
                      baseAmount: parseFloat(row.baseAmount) || 0,
                      vatAmount: parseFloat(row.vatAmount) || 0,
                      whtAmount: parseFloat(row.whtAmount) || 0,
                      netPaid: row.netPaid,
                      transferDate: row.transferDate || "2026-05-27"
                    }));

                    const newLog: ShipmentFinancials = {
                      id: Date.now().toString(),
                      diNumber: financialForm.diNumber,
                      shipmentType: financialForm.shipmentType,
                      invoiceNo: financialForm.invoiceNo,
                      customer: financialForm.customer,
                      product: financialForm.product,
                      volumeMt: parseFloat(financialForm.volumeMt) || 0,
                      sellingPrice: parseFloat(financialForm.sellingPrice) || 0,
                      revenue: financialForm.revenue,
                      cogs: parseFloat(financialForm.cogs) || 0,
                      costRows: savedRows
                    };

                    await saveFinancialLog(newLog);
                    setFinancialLogs([newLog, ...financialLogs]);
                    setFinancialForm({
                      diNumber: "",
                      shipmentType: "container",
                      invoiceNo: "",
                      customer: "",
                      product: "",
                      volumeMt: "",
                      sellingPrice: "",
                      revenue: 0,
                      cogs: "",
                      costRows: []
                    });
                  }}
                  className="space-y-6 text-xs font-sans"
                >
                  {/* SECTION 1: CORE SHIPMENT INFO */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-mono bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/30">
                      Section 1: Core Shipment Info
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/20 p-4 rounded-2xl border border-slate-900">
                      {/* DI Number select */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          DI Number
                        </label>
                        <select
                          value={financialForm.diNumber}
                          onChange={(e) => {
                            const di = e.target.value;
                            if (!di) {
                              setFinancialForm({
                                diNumber: "",
                                shipmentType: "container",
                                invoiceNo: "",
                                customer: "",
                                product: "",
                                volumeMt: "",
                                sellingPrice: "",
                                revenue: 0,
                                cogs: "",
                                costRows: []
                              });
                              return;
                            }

                            const ship = shipments.find(s => s.di_no === di);
                            let resolvedType: "container" | "bulk" | "domestic" = "container";
                            let volume = "";
                            let price = "";
                            let revenue = 0;
                            let customerName = "";
                            let productName = "";

                            if (ship) {
                              if (ship.shipment_type === "bulk") resolvedType = "bulk";
                              else if (ship.shipment_type === "domestic") resolvedType = "domestic";

                              volume = ship.quantity_tons ? ship.quantity_tons.toString() : "";
                              
                              const matchingPO = purchaseOrders.find(po => po.po_no === ship.po_no);
                              if (matchingPO) {
                                price = matchingPO.price_mt ? matchingPO.price_mt.toString() : "";
                                productName = matchingPO.core_product || ship.product_info || "";
                                
                                const matchingCust = customers.find(c => c.customer_id === matchingPO.customer_id);
                                if (matchingCust) {
                                  customerName = matchingCust.customer_name;
                                }
                              } else {
                                productName = ship.product_info || "";
                              }

                              if (volume && price) {
                                revenue = parseFloat(volume) * parseFloat(price);
                              }
                            }

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            let defaultRows: any[] = [];
                            if (resolvedType === "container") {
                              defaultRows = CONTAINER_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            } else if (resolvedType === "bulk") {
                              defaultRows = BULK_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            } else {
                              defaultRows = DOMESTIC_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            }

                            setFinancialForm({
                              diNumber: di,
                              shipmentType: resolvedType,
                              invoiceNo: `INV-${di}_2025`,
                              customer: customerName,
                              product: productName,
                              volumeMt: volume,
                              sellingPrice: price,
                              revenue: revenue,
                              cogs: ship && ship.contract_value ? Math.round(ship.contract_value * 0.7).toString() : "",
                              costRows: defaultRows
                            });
                          }}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
                        >
                          <option value="">-- Select DI --</option>
                          {shipments.map(s => (
                            <option key={s.di_no} value={s.di_no}>{s.di_no} ({s.product_info || "Shipment"})</option>
                          ))}
                        </select>
                      </div>

                      {/* Shipment Type selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Shipment Type
                        </label>
                        <select
                          value={financialForm.shipmentType}
                          onChange={(e) => {
                            const newType = e.target.value as "container" | "bulk" | "domestic";
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            let defaultRows: any[] = [];
                            if (newType === "container") {
                              defaultRows = CONTAINER_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            } else if (newType === "bulk") {
                              defaultRows = BULK_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            } else {
                              defaultRows = DOMESTIC_DEFAULT_ROWS.map(r => ({ ...r, baseAmount: r.baseAmount.toString(), vatAmount: r.vatAmount.toString(), whtAmount: r.whtAmount.toString() }));
                            }
                            setFinancialForm({
                              ...financialForm,
                              shipmentType: newType,
                              costRows: defaultRows
                            });
                          }}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="container">Ocean Container</option>
                          <option value="bulk">Bulk Vessel Carrier</option>
                          <option value="domestic">Cross-Border Trucking</option>
                        </select>
                      </div>

                      {/* Invoice No */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Invoice No.
                        </label>
                        <input
                          type="text"
                          placeholder="INV-XXXX_2025"
                          value={financialForm.invoiceNo}
                          onChange={(e) => setFinancialForm({ ...financialForm, invoiceNo: e.target.value })}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Customer */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                          Customer
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={financialForm.customer || "Auto-completed"}
                          className="w-full p-2 bg-slate-950/20 border border-slate-900 rounded-xl text-xs text-slate-400 font-bold"
                        />
                      </div>

                      {/* Product */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                          Product Spec
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={financialForm.product || "Auto-completed"}
                          className="w-full p-2 bg-slate-950/20 border border-slate-900 rounded-xl text-xs text-slate-400 font-bold"
                        />
                      </div>

                      {/* Selling Price */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Selling Price (THB/MT)
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={financialForm.sellingPrice}
                          onChange={(e) => {
                            const priceVal = e.target.value;
                            const volumeVal = parseFloat(financialForm.volumeMt) || 0;
                            const newRev = volumeVal * (parseFloat(priceVal) || 0);
                            setFinancialForm({
                              ...financialForm,
                              sellingPrice: priceVal,
                              revenue: newRev
                            });
                          }}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>

                      {/* Volume MT */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Volume (MT)
                        </label>
                        <input
                          type="number"
                          placeholder="0.000"
                          step="0.001"
                          value={financialForm.volumeMt}
                          onChange={(e) => {
                            const volumeVal = e.target.value;
                            const priceVal = parseFloat(financialForm.sellingPrice) || 0;
                            const newRev = (parseFloat(volumeVal) || 0) * priceVal;
                            setFinancialForm({
                              ...financialForm,
                              volumeMt: volumeVal,
                              revenue: newRev
                            });
                          }}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>

                      {/* Calculated Gross Revenue */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                          Gross Revenue (THB)
                        </label>
                        <div className="w-full p-2 bg-blue-950/10 border border-blue-900/30 rounded-xl text-xs text-blue-300 font-extrabold font-mono flex items-center h-8">
                          ฿{financialForm.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* COGS */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Product COGS (FOB) (THB)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financialForm.cogs}
                          onChange={(e) => setFinancialForm({ ...financialForm, cogs: e.target.value })}
                          className="w-full p-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 & 3: DYNAMIC ACCOUNTING SPREADSHEET GRID */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-mono bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/30">
                      Section 2 & 3: Shipment Clearing Expense Checklist Grid
                    </span>
                    <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950/10">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b border-slate-900 bg-slate-950/40 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                            <th className="py-2.5 px-3 w-1/4">Cost Item (รายการ)</th>
                            <th className="py-2.5 px-2 w-1/6 text-right">Base Amount (ยอดเดิม)</th>
                            <th className="py-2.5 px-2 w-1/8 text-right">VAT Amount</th>
                            <th className="py-2.5 px-2 w-1/8 text-right">Withholding Tax (หัก ณ ที่จ่าย)</th>
                            <th className="py-2.5 px-2 w-1/6 text-right">Net Paid THB (ยอดสุทธิ - บาท)</th>
                            <th className="py-2.5 px-3 w-1/5">Transfer Date (วันที่โอน)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-xs font-sans">
                          {financialForm.costRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-500 font-bold uppercase tracking-wider">
                                Select a DI above to load dynamic clearing items
                              </td>
                            </tr>
                          ) : (
                            financialForm.costRows.map((row, idx) => {
                              const isDespatch = row.item === "Despatch Cashback Credit" || row.item.includes("Despatch");
                              return (
                                <tr key={idx} className={`hover:bg-slate-900/10 transition-all ${isDespatch ? "bg-emerald-950/5" : ""}`}>
                                  {/* Item & Supplier */}
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-white leading-tight">{row.item}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">{row.supplier}</div>
                                  </td>

                                  {/* Base Amount */}
                                  <td className="py-2 px-2 text-right">
                                    <input
                                      type="number"
                                      value={row.baseAmount}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const base = parseFloat(val) || 0;
                                        const vat = parseFloat(row.vatAmount) || 0;
                                        const wht = parseFloat(row.whtAmount) || 0;
                                        
                                        const updatedRows = [...financialForm.costRows];
                                        updatedRows[idx] = {
                                          ...row,
                                          baseAmount: val,
                                          netPaid: base + vat - wht
                                        };
                                        setFinancialForm({ ...financialForm, costRows: updatedRows });
                                      }}
                                      className="w-20 p-1.5 bg-slate-950/60 border border-slate-850 rounded text-right text-xs text-white focus:outline-none focus:border-cyan-500 font-mono inline-block"
                                    />
                                  </td>

                                  {/* VAT Amount */}
                                  <td className="py-2 px-2 text-right">
                                    <input
                                      type="number"
                                      value={row.vatAmount}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const base = parseFloat(row.baseAmount) || 0;
                                        const vat = parseFloat(val) || 0;
                                        const wht = parseFloat(row.whtAmount) || 0;
                                        
                                        const updatedRows = [...financialForm.costRows];
                                        updatedRows[idx] = {
                                          ...row,
                                          vatAmount: val,
                                          netPaid: base + vat - wht
                                        };
                                        setFinancialForm({ ...financialForm, costRows: updatedRows });
                                      }}
                                      className="w-16 p-1.5 bg-slate-950/60 border border-slate-850 rounded text-right text-xs text-white focus:outline-none focus:border-cyan-500 font-mono inline-block"
                                    />
                                  </td>

                                  {/* Withholding Tax */}
                                  <td className="py-2 px-2 text-right">
                                    <input
                                      type="number"
                                      value={row.whtAmount}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const base = parseFloat(row.baseAmount) || 0;
                                        const vat = parseFloat(row.vatAmount) || 0;
                                        const wht = parseFloat(val) || 0;
                                        
                                        const updatedRows = [...financialForm.costRows];
                                        updatedRows[idx] = {
                                          ...row,
                                          whtAmount: val,
                                          netPaid: base + vat - wht
                                        };
                                        setFinancialForm({ ...financialForm, costRows: updatedRows });
                                      }}
                                      className="w-16 p-1.5 bg-slate-950/60 border border-slate-850 rounded text-right text-xs text-white focus:outline-none focus:border-cyan-500 font-mono inline-block"
                                    />
                                  </td>

                                  {/* Calculated Net Paid */}
                                  <td className="py-2 px-2 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-extrabold font-mono inline-block ${
                                      isDespatch
                                        ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/30"
                                        : "bg-slate-900 border border-slate-850 text-white"
                                    }`}>
                                      {isDespatch ? "-" : ""}฿{row.netPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>

                                  {/* Transfer Date */}
                                  <td className="py-2 px-3">
                                    <input
                                      type="date"
                                      value={row.transferDate}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updatedRows = [...financialForm.costRows];
                                        updatedRows[idx] = { ...row, transferDate: val };
                                        setFinancialForm({ ...financialForm, costRows: updatedRows });
                                      }}
                                      className="w-full max-w-[130px] p-1.5 bg-slate-950/60 border border-slate-850 rounded text-xs text-white focus:outline-none focus:border-cyan-500 font-mono inline-block cursor-pointer"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FORM SUMMARY PANEL AND SUBMIT BUTTON */}
                  {financialForm.diNumber && (
                    <div className="flex flex-col sm:flex-row justify-between items-stretch gap-4 pt-2">
                      {/* Live Profitability / Net Margin Card */}
                      {(() => {
                        const revenue = financialForm.revenue;
                        const totalCosts = formTotalShipmentCost;
                        const profit = revenue - totalCosts;
                        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                        const isProfitable = profit >= 0;
                        const alertState = profit < 0 || margin < 5;

                        return (
                          <div className={`p-4 rounded-2xl border flex flex-col justify-center flex-grow ${
                            alertState
                              ? "bg-red-950/15 border-red-900/40 text-red-300"
                              : "bg-emerald-950/15 border-emerald-900/40 text-emerald-300"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider font-mono opacity-80">
                                Live Estimate Profit Summary
                              </span>
                              {alertState ? (
                                <span className="px-2 py-0.5 rounded bg-red-900/30 text-[9px] font-extrabold uppercase font-mono tracking-wider border border-red-800/45 animate-pulse">
                                  ⚠️ LOW MARGIN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-900/30 text-[9px] font-extrabold uppercase font-mono tracking-wider border border-emerald-800/45">
                                  🟢 OPTIMAL
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-850/50 text-left">
                              <div>
                                <span className="text-[8px] uppercase text-slate-500 font-mono block">Total Net Cost</span>
                                <span className="text-xs font-bold text-white font-mono">
                                  ฿{totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] uppercase text-slate-500 font-mono block">Est. Net Profit</span>
                                <span className={`text-xs font-extrabold font-mono ${isProfitable ? "text-emerald-450" : "text-red-400"}`}>
                                  {isProfitable ? "" : "-"}฿{Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] uppercase text-slate-500 font-mono block">Net Margin</span>
                                <span className={`text-xs font-extrabold font-mono ${isProfitable ? "text-emerald-455" : "text-red-405"}`}>
                                  {Math.round(margin)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Log Button Container */}
                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          className="w-full sm:w-auto py-3.5 px-6 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-2xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1.5 font-sans"
                        >
                          <span>+ Log Transaction Financials</span>
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* MINIMALIST NET PROFIT TREND CHART (col-span-1) */}
              <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-900 space-y-4 flex flex-col justify-between">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-900/60">
                  <span className="text-emerald-450 text-sm">📈</span>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Net Profit Trend Corridor
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Dynamic profit band curve (JAN - DEC 2026)
                    </p>
                  </div>
                </div>

                {/* SVG Line / Area chart */}
                <div className="w-full h-[180px] mt-2 relative">
                  <svg viewBox="0 0 600 180" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="profitTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Chart horizontal grid ticks */}
                    {financialChartCoords.yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1="50"
                          y1={tick.y}
                          x2="580"
                          y2={tick.y}
                          stroke="#1e293b"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text
                          x="42"
                          y={tick.y + 3}
                          textAnchor="end"
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          ฿{tick.val.toLocaleString()}
                        </text>
                      </g>
                    ))}

                    {/* Area fill */}
                    <path d={financialChartCoords.areaPath} fill="url(#profitTrendAreaGrad)" />

                    {/* Line path */}
                    <path
                      d={financialChartCoords.linePath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Month labels and node markers */}
                    {financialChartCoords.points.map((p, i) => (
                      <g key={i}>
                        <line
                          x1={p.x}
                          y1="155"
                          x2={p.x}
                          y2="159"
                          stroke="#334155"
                          strokeWidth="1"
                        />
                        {i % 2 === 0 && (
                          <text
                            x={p.x}
                            y="170"
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {p.month}
                          </text>
                        )}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="3"
                          fill="#10b981"
                          stroke="#0f172a"
                          strokeWidth="1"
                        />
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="p-3 bg-slate-950/30 border border-slate-900 rounded-xl text-[9px] font-bold text-slate-450 uppercase tracking-wider text-center font-mono">
                  🟢 Secured Net Margin Curve &bull; dynamic forecasting
                </div>
              </div>
            </div>

            {/* FINANCIAL SPREADSHEET LEDGER */}
            <div className="glass-card rounded-3xl overflow-hidden border border-slate-900">
              <div className="p-4 bg-slate-950/40 border-b border-slate-900 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Shipment Financial Command Ledger spreadsheet
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {financialLogs.length} Logged Transactions
                </span>
              </div>
              <div className="overflow-x-auto font-sans">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none font-mono">
                      <th className="py-4 px-5">DI NUMBER</th>
                      <th className="py-4 px-3">SHIPMENT TYPE</th>
                      <th className="py-4 px-3">GROSS REVENUE (THB)</th>
                      <th className="py-4 px-3">OCEAN FREIGHT COST (THB) (AUTO)</th>
                      <th className="py-4 px-3">TOTAL EXPENSE COST (THB)</th>
                      <th className="py-4 px-3">NET PROFIT (THB)</th>
                      <th className="py-4 px-3 text-center font-mono">FINANCIAL STATUS FLAG</th>
                      <th className="py-4 px-3 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-xs font-mono">
                    {financialLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                          No logged financial transactions detected.
                        </td>
                      </tr>
                    ) : (
                      financialLogs.map((log) => {
                        const { totalCosts, oceanFreight } = getShipmentCostDetails(log);
                        const profit = log.revenue - totalCosts;
                        const margin = log.revenue > 0 ? (profit / log.revenue) * 100 : 0;
                        const spikeAlert = profit < 0 || margin < 5; // Alert if profit is negative or margin drops below 5% target

                        return (
                          <tr key={log.id} className={`hover:bg-slate-900/10 transition-all ${
                            spikeAlert ? "text-red-400 font-semibold" : "text-slate-300"
                          }`}>
                            {/* DI NUMBER */}
                            <td className="py-3.5 px-5 font-bold font-mono">
                              <span className={spikeAlert ? "text-red-400" : "text-white"}>{log.diNumber}</span>
                            </td>

                            {/* SHIPMENT TYPE */}
                            <td className="py-3.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                log.shipmentType === "container" 
                                  ? "bg-blue-950/45 text-blue-300 border border-blue-900/30" 
                                  : log.shipmentType === "bulk"
                                    ? "bg-purple-950/45 text-purple-300 border border-purple-900/30"
                                    : "bg-orange-950/45 text-orange-300 border border-orange-900/30"
                              }`}>
                                {log.shipmentType}
                              </span>
                            </td>

                            {/* GROSS REVENUE */}
                            <td className="py-3.5 px-3 font-semibold font-sans">
                              ฿{log.revenue.toLocaleString()}
                            </td>

                            {/* OCEAN FREIGHT */}
                            <td className="py-3.5 px-3 font-semibold font-sans text-slate-400">
                              {oceanFreight > 0 ? `฿${oceanFreight.toLocaleString()}` : "฿0"}
                            </td>

                            {/* TOTAL COST */}
                            <td className={`py-3.5 px-3 font-semibold font-sans ${spikeAlert ? "text-red-400" : "text-slate-200"}`}>
                              ฿{totalCosts.toLocaleString()}
                            </td>

                            {/* NET PROFIT */}
                            <td className={`py-3.5 px-3 font-extrabold text-sm ${profit >= 0 ? "text-emerald-450" : "text-red-400"}`}>
                              {profit >= 0 ? "" : "-"}฿{Math.abs(profit).toLocaleString()}
                            </td>

                            {/* STATUS FLAG BADGE */}
                            <td className="py-3.5 px-3 text-center">
                              {spikeAlert ? (
                                <span className="px-2.5 py-0.5 rounded bg-red-950/45 border border-red-500/20 text-[9px] font-extrabold text-red-400 inline-block font-sans">
                                  🔴 Cost Spike Alert
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded bg-emerald-950/45 border border-emerald-500/20 text-[9px] font-extrabold text-emerald-400 inline-block font-sans">
                                  🟢 Profitable
                                </span>
                              )}
                            </td>

                            {/* DELETE ACTION */}
                            <td className="py-3.5 px-3 text-center">
                              <button
                                onClick={() => setFinancialLogs(financialLogs.filter(f => f.id !== log.id))}
                                className="text-red-400 hover:text-red-300 cursor-pointer transition-all p-1"
                                title="Delete financials"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
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
        )}
      </main>

      {/* ======================================================== */}
      {/* SIDE DRAWER: LOGISTICS OPERATION WORKSPACE (SINGLE EDIT) */}
      {/* ======================================================== */}
      {editingDI && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Overlay background */}
          <div 
            onClick={() => setEditingDI(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
          ></div>

          {/* Drawer Body panel */}
          <div className="relative w-full max-w-lg glass-panel h-full border-l border-slate-900 shadow-2xl p-6 flex flex-col justify-between z-10 animate-slide-in">
            <div>
              {/* Header Title */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Container className="w-5 h-5 text-blue-400" /> Logistics Operation Workspace
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                    SHIPMENT: {editingDI.di_no} &bull; PO: {editingDI.po_no}
                  </p>
                </div>
                <button
                  onClick={() => setEditingDI(null)}
                  className="p-1 text-slate-400 hover:text-white bg-slate-900/60 rounded-lg border border-slate-800 cursor-pointer"
                  title="Close Workspace"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-900 mb-5 text-xs font-semibold select-none">
                <button
                  type="button"
                  onClick={() => setActiveModalTab("general")}
                  className={`flex-1 pb-3 text-center transition-all border-b-2 cursor-pointer ${
                    activeModalTab === "general"
                      ? "border-blue-500 text-blue-400 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  General Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("logistics")}
                  className={`flex-1 pb-3 text-center transition-all border-b-2 cursor-pointer ${
                    activeModalTab === "logistics"
                      ? "border-blue-500 text-blue-400 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Container & Logistics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab("status")}
                  className={`flex-1 pb-3 text-center transition-all border-b-2 cursor-pointer ${
                    activeModalTab === "status"
                      ? "border-blue-500 text-blue-400 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Docs & Status
                </button>
              </div>

              {/* Form Controls */}
              <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1 scrollbar-thin">
                {/* TAB 1: General Info (Read-Only Overview) */}
                {activeModalTab === "general" && (() => {
                  const parentPO = purchaseOrders.find(po => po.po_no === editingDI.po_no);
                  const cust = parentPO ? customers.find(c => c.customer_id === parentPO.customer_id) : null;
                  const customerName = cust ? cust.customer_name : "Unknown Customer";

                  return (
                    <div className="space-y-4 animate-fade-in">
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-4">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                          Core Overview Reference (Read-Only)
                        </h4>
                        
                        {/* INV / Invoice No */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            INV / Invoice No.
                          </label>
                          <input
                            type="text"
                            value={editingDI.invoice_no || "N/A"}
                            disabled
                            className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* DI Number */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              DI Number
                            </label>
                            <input
                              type="text"
                              value={editingDI.di_no}
                              disabled
                              className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                            />
                          </div>

                          {/* PO Reference */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              PO Reference
                            </label>
                            <input
                              type="text"
                              value={editingDI.po_no}
                              disabled
                              className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Customer Entity */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Customer Entity
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            disabled
                            className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Product ID */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Product Specifier
                            </label>
                            <input
                              type="text"
                              value={editingDI.product_id}
                              disabled
                              className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                            />
                          </div>

                          {/* Tonnage Quantity */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Total Quantity (Tons)
                            </label>
                            <input
                              type="text"
                              value={`${Number(editingDI.quantity_tons).toFixed(3)} tons`}
                              disabled
                              className="w-full p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs text-slate-500 focus:outline-none select-none cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 2: Container & Logistics (Container Details) */}
                {activeModalTab === "logistics" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-4">
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                        Equipment & Dispatch Logistics
                      </h4>

                      {/* Shipment Type Selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Shipment Mode / Type
                        </label>
                        <select
                          value={editingDI.shipment_type || "container"}
                          onChange={(e) => setEditingDI({ ...editingDI, shipment_type: e.target.value as "container" | "bulk" | "domestic" })}
                          className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer font-bold"
                        >
                          <option value="container">📦 Container Loading</option>
                          <option value="bulk">🚢 Bulk Vessel Transit</option>
                          <option value="domestic">🚛 Truck Logistics</option>
                        </select>
                      </div>

                      {/* Conditional Fields based on Shipment Type Selector */}
                      {(editingDI.shipment_type === "container" || !editingDI.shipment_type) && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Container Size */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Container Size
                              </label>
                              <select
                                value={editingDI.container_size || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, container_size: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">-- Choose Size --</option>
                                <option value="20'">20&apos;</option>
                                <option value="40'">40&apos;</option>
                                <option value="40' HQ">40&apos; HQ</option>
                              </select>
                            </div>

                            {/* Container Quantity */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Container Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="999"
                                step="1"
                                placeholder="e.g. 3"
                                value={editingDI.container_qty || 1}
                                onChange={(e) => setEditingDI({ ...editingDI, container_qty: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Container Serial No. */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Container Serial No.
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. MSCU9827"
                                value={editingDI.container_no || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, container_no: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            {/* Forwarder Seal No. */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Forwarder Seal No.
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. SEAL-9928"
                                value={editingDI.seal_no || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, seal_no: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Forwarder Booking */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Forwarder Booking
                              </label>
                              <select
                                value={editingDI.forwarder_id || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, forwarder_id: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">-- Choose Forwarder --</option>
                                {FORWARDERS.map(f => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>

                            {/* Vessel / Voyage assign */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Vessel / Voyage Assign
                              </label>
                              <select
                                value={editingDI.vessel_voyage || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, vessel_voyage: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">-- Choose Vessel / Voyage --</option>
                                {VESSELS.map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {editingDI.shipment_type === "bulk" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Vessel / Voyage Name */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Vessel / Voyage Name
                              </label>
                              <select
                                value={editingDI.vessel_voyage || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, vessel_voyage: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer font-medium"
                              >
                                <option value="">-- Choose Vessel / Voyage --</option>
                                {VESSELS.map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </div>

                            {/* Barge Quantity */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Barge Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="e.g. 2"
                                value={editingDI.container_qty || 1}
                                onChange={(e) => setEditingDI({ ...editingDI, container_qty: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Barge ID */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Barge ID / Name
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. BG-901 / BG-902"
                                value={editingDI.container_no || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, container_no: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                              />
                            </div>

                            {/* Barge Loading Point */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Barge Loading Point
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. WH-B / Sichang Anchorage"
                                value={editingDI.seal_no || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, seal_no: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                              />
                            </div>
                          </div>

                          {/* Stevedore PIC */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Stevedore PIC
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Pai / Ae"
                              value={editingDI.forwarder_id || ""}
                              onChange={(e) => setEditingDI({ ...editingDI, forwarder_id: e.target.value })}
                              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                            />
                          </div>
                        </div>
                      )}

                      {editingDI.shipment_type === "domestic" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Truck License Plate */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Truck License Plate
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 70-1234 BKK"
                                value={editingDI.container_no || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, container_no: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                              />
                            </div>

                            {/* Warehouse Terminal/Gate */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Warehouse Terminal / Gate
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Terminal 2, Gate B"
                                value={editingDI.forwarder_id || ""}
                                onChange={(e) => setEditingDI({ ...editingDI, forwarder_id: e.target.value })}
                                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                              />
                            </div>
                          </div>

                          {/* Driver Name & Phone */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Driver Name & Phone
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Somchai (081-234-5678)"
                              value={editingDI.seal_no || ""}
                              onChange={(e) => setEditingDI({ ...editingDI, seal_no: e.target.value })}
                              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Loading Schedule Splitter */}
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                          Loading Schedule Splitter
                        </h4>
                        <span className="text-[8px] bg-blue-950/40 border border-blue-500/10 text-blue-300 font-bold px-1.5 py-0.5 rounded">
                          Target: {editingDI.container_qty || 1} Load{(editingDI.container_qty || 1) !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {(!editingDI.loading_splits || editingDI.loading_splits.length === 0) ? (
                        <div className="text-center py-4">
                          <p className="text-[10px] text-slate-500 mb-2.5">
                            This shipment is currently mapped to a single loading day schedule.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDI({
                                ...editingDI,
                                loading_splits: [
                                  { 
                                    date: editingDI.loading_start_date || editingDI.etd_date || new Date().toISOString().split("T")[0], 
                                    qty: editingDI.container_qty || 1 
                                  }
                                ]
                              });
                            }}
                            className="py-1 px-3 bg-slate-900 hover:bg-slate-800 text-blue-300 rounded-lg text-[10px] font-bold border border-slate-800 transition-all cursor-pointer"
                          >
                            Configure Multi-Day Load Splits
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Column Headers for Splitter Rows */}
                          <div className="grid grid-cols-[3.5rem_1fr_6rem_2.5rem] gap-2 items-center text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">
                            <span>Day</span>
                            <span>Loading Date</span>
                            <span className="text-right pr-2">Loading Units</span>
                            <span></span>
                          </div>

                          {editingDI.loading_splits.map((split, idx) => (
                            <div key={idx} className="grid grid-cols-[3.5rem_1fr_6rem_2.5rem] gap-2 items-center animate-fade-in">
                              <span className="text-[10px] text-slate-500 font-bold">
                                Day {idx + 1}
                              </span>
                              
                              {/* Date Selector */}
                              <input
                                type="date"
                                value={split.date}
                                onChange={(e) => {
                                  const newSplits = [...(editingDI.loading_splits || [])];
                                  newSplits[idx].date = e.target.value;
                                  setEditingDI({ ...editingDI, loading_splits: newSplits });
                                }}
                                className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                                title="Loading Date"
                              />

                              {/* Loading Units */}
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="Units"
                                value={split.qty}
                                onChange={(e) => {
                                  const newSplits = [...(editingDI.loading_splits || [])];
                                  newSplits[idx].qty = Number(e.target.value);
                                  setEditingDI({ ...editingDI, loading_splits: newSplits });
                                }}
                                className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                                title="Loading Units"
                              />

                              {/* Delete Split Row */}
                              <button
                                type="button"
                                onClick={() => {
                                  const newSplits = (editingDI.loading_splits || []).filter((_, i) => i !== idx);
                                  setEditingDI({ 
                                    ...editingDI, 
                                    loading_splits: newSplits.length === 0 ? null : newSplits 
                                  });
                                }}
                                className="p-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded-lg border border-red-500/20 transition-all cursor-pointer flex items-center justify-center w-full"
                                title="Remove loading split row"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                            <span className={`text-[9px] font-bold ${
                              editingDI.loading_splits.reduce((sum, s) => sum + s.qty, 0) === (editingDI.container_qty || 1)
                                ? "text-emerald-400"
                                : "text-amber-500 animate-pulse"
                            }`}>
                              Total Allocated: {editingDI.loading_splits.reduce((sum, s) => sum + s.qty, 0)} / {editingDI.container_qty || 1}
                            </span>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const newSplits = [...(editingDI.loading_splits || [])];
                                const latestDate = newSplits[newSplits.length - 1]?.date || new Date().toISOString().split("T")[0];
                                const nextDate = new Date(new Date(latestDate).getTime() + 86400000).toISOString().split("T")[0];
                                newSplits.push({ date: nextDate, qty: 1 });
                                setEditingDI({ ...editingDI, loading_splits: newSplits });
                              }}
                              className="py-1 px-2.5 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 rounded-lg text-[9px] font-bold border border-blue-500/20 transition-all cursor-pointer"
                            >
                              + Add Allocation Day
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: Shipping Docs & Status (Timeline & Files) */}
                {activeModalTab === "status" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-900 space-y-4">
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                        Clearance Timeline & Shipping Dossiers
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Chronological Pipeline Status */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Pipeline Stage Status
                          </label>
                          <select
                            value={editingDI.status}
                            onChange={(e) => setEditingDI({ ...editingDI, status: e.target.value as Shipment["status"] })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                          >
                            {PIPELINE_STAGES.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Booking No */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Booking No. / Status
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. BK-2601"
                            value={editingDI.booking_no || ""}
                            onChange={(e) => setEditingDI({ ...editingDI, booking_no: e.target.value })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Document Clearance Status */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Document Clearance Status
                        </label>
                        <select
                          value={editingDI.doc_status || "preparing_docs"}
                          onChange={(e) => setEditingDI({ ...editingDI, doc_status: e.target.value as Shipment["doc_status"] })}
                          className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                        >
                          {editingDI.shipment_type === "bulk" ? (
                            <>
                              <option value="get_booking">PO Issued (Book)</option>
                              <option value="preparing_docs">WH Weight (Prep)</option>
                              <option value="confirm_bl">Draft Docs (BL)</option>
                              <option value="all_ship_docs_completed">All Ship Docs (Completed)</option>
                            </>
                          ) : editingDI.shipment_type === "domestic" ? (
                            <>
                              <option value="get_booking">PO Issued (Book)</option>
                              <option value="preparing_docs">Delivery Order (Prep)</option>
                              <option value="confirm_bl">Invoice (BL)</option>
                              <option value="all_ship_docs_completed">Paid (Completed)</option>
                            </>
                          ) : (
                            <>
                              <option value="get_booking">Booking Confirmation Received (Book)</option>
                              <option value="preparing_docs">Preparing Documents (Prep)</option>
                              <option value="confirm_bl">Confirm Bill of Lading (BL)</option>
                              <option value="confirm_draft_docs">Confirm Draft Docs (Draft)</option>
                              <option value="all_ship_docs_completed">All Shipping Docs Completed (Completed)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Departure Date (ETD) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Departure Date (ETD)
                          </label>
                          <input
                            type="date"
                            value={editingDI.etd_date || ""}
                            onChange={(e) => setEditingDI({ ...editingDI, etd_date: e.target.value })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                          />
                        </div>

                        {/* Destination Date (ETA) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Destination Date (ETA)
                          </label>
                          <input
                            type="date"
                            value={editingDI.eta_date || ""}
                            onChange={(e) => setEditingDI({ ...editingDI, eta_date: e.target.value })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-3 border-t border-slate-900">
                        {/* B/L Draft Link */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            B/L Draft Link URL
                          </label>
                          <input
                            type="text"
                            placeholder="https://example.com/drafts/bl.pdf"
                            value={editingDI.bl_draft_link || ""}
                            onChange={(e) => setEditingDI({ ...editingDI, bl_draft_link: e.target.value })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Shipping Docs Link */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Shipping Dossier Link URL
                          </label>
                          <input
                            type="text"
                            placeholder="https://example.com/docs/docs.zip"
                            value={editingDI.shipping_docs_link || ""}
                            onChange={(e) => setEditingDI({ ...editingDI, shipping_docs_link: e.target.value })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* B/L Approval Feedback */}
                      {editingDI.status === "awaiting_bl_confirmation" && editingDI.bl_approval_status !== "pending" && (
                        <div className={`p-3.5 rounded-xl border text-xs ${
                          editingDI.bl_approval_status === "approved" 
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" 
                            : "bg-rose-950/20 border-rose-500/30 text-rose-400"
                        }`}>
                          <span className="font-bold block capitalize mb-1">
                            Customer Feedback: {editingDI.bl_approval_status}
                          </span>
                          &quot;{editingDI.bl_feedback || "No comment logged by client."}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Drawer */}
            <div className="border-t border-slate-900 pt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditingDI(null)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 text-white font-semibold rounded-xl text-xs border border-slate-800 transition-all cursor-pointer text-center"
              >
                Cancel Changes
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {savingEdit ? "Saving..." : "Save Logistics Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
