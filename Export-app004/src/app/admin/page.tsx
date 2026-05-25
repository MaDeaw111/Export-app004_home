"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getCurrentUser, 
  getCustomers, 
  getPurchaseOrders, 
  getShipments, 
  updateShipment, 
  updateShipmentsBulk,
  createPurchaseOrder,
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
  Briefcase,
  Users,
  Compass,
  ArrowRight,
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

function AdminPortalContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  const [activeTab, setActiveTab] = useState<"logs" | "create" | "calendar">("logs");

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

  // Notification Banner
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Initial Data Load
  const loadAllData = async () => {
    try {
      const custs = await getCustomers();
      const pos = await getPurchaseOrders();
      const ships = await getShipments();
      
      setCustomers(custs);
      setPurchaseOrders(pos);
      setShipments(ships);
    } catch (err) {
      console.error("Failed to query administration logs:", err);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
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
    if (bulkStatus) updates.status = bulkStatus as any;
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
    } catch (err) {
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
    } catch (err) {
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

  const handleSplitRowChange = (idx: number, field: string, value: any) => {
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
        setActiveTab("logs");
        loadAllData();
      } else {
        showNotification("Failed to save PO. Verify if the PO number is unique.", "error");
      }
    } catch (err) {
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
          } catch (err) {
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
                      <span className="truncate">{ship.di_no}</span>
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
      } catch (err) {
        console.error(err);
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
                    <div className="relative w-full pt-2 pb-8 px-8">
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
                              <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
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
                  {impersonatedShipment.shipment_type === "domestic" ? "Domestic Docs Clearance" : "Document Clearance Hub"}
                </div>
                {(() => {
                  const type = impersonatedShipment.shipment_type || "container";
                  const shipStatus = impersonatedShipment.status || (impersonatedShipment as any).shipment_status;
                  const getDocActiveIndex = (s: typeof impersonatedShipment, status: string) => {
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
                    <div className="relative w-full pt-2 pb-8 px-8">
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
                              <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
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
                        <span>Amendment requested. Feedback logged: "{impersonatedShipment.bl_feedback}"</span>
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
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total 20' Cont.</span>
            <h3 className="text-xl font-bold text-blue-300 mt-1">{stats.total20}</h3>
          </div>
          {/* Card 2: Total 40' Containers */}
          <div className="glass-card rounded-2xl p-4 border border-blue-500/10">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total 40'/HQ Cont.</span>
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
            onClick={() => setActiveTab("logs")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "logs" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            <Briefcase className="w-4 h-4" /> Global Shipment Log
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "create" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            <Plus className="w-4 h-4" /> Create & Split PO Form
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "calendar" 
                ? "bg-blue-600 text-slate-950 font-bold shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-white bg-slate-900/30 border border-slate-900 hover:border-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" /> Interactive Logistics Calendar
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
        {/* TAB 2: CREATE & SPLIT PO FORM                            */}
        {/* ======================================================== */}
        {activeTab === "create" && (
          <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-900 shadow-xl max-w-4xl mx-auto">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" /> Log Purchase Order & Split DI Instruction Rows
            </h2>

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
                    onChange={(e) => setNewPO(prev => ({ ...prev, shipment_type: e.target.value as any }))}
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
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
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
                    setActiveTab("logs");
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
                    } catch (err) {
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
                            <option value="20'">20'</option>
                            <option value="40'">40'</option>
                            <option value="40' HQ">40' HQ</option>
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
                        Clearance Timeline & shipping dossiers
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Chronological Pipeline Status */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Pipeline Stage Status
                          </label>
                          <select
                            value={editingDI.status}
                            onChange={(e) => setEditingDI({ ...editingDI, status: e.target.value as any })}
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
                          onChange={(e) => setEditingDI({ ...editingDI, doc_status: e.target.value as any })}
                          className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                        >
                          <option value="get_booking">Booking Confirmation Received (Book)</option>
                          <option value="preparing_docs">Preparing Documents (Prep)</option>
                          <option value="confirm_bl">Confirm Bill of Lading (BL)</option>
                          <option value="confirm_draft_docs">Confirm Draft Docs (Draft)</option>
                          <option value="all_ship_docs_completed">All Shipping Docs Completed (Completed)</option>
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
                          "{editingDI.bl_feedback || "No comment logged by client."}"
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
