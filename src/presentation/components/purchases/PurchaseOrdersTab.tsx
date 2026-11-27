import React, { useMemo, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { PurchaseOrderLineDraftInput } from "../../../application/store/storeTypes";
import {
  ProductEntity,
  PurchaseOrderDispatchChannel,
  PurchaseOrderEntity,
  PurchaseOrderStatus,
} from "../../../domain/entities";
import {
  buildWhatsAppOrderText,
  buildWhatsAppUrl,
} from "../../../domain/utils/whatsappHelper";
import { ProductQuickPicker } from "../common/ProductQuickPicker";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
  useTableSort,
} from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import {
  TableColumnDef,
  useTableColumns,
} from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import {
  TableExportButton,
  TableExportColumn,
} from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  ClipboardCheck,
  Send,
  RefreshCw,
  PackageCheck,
  Ban,
  Trash2,
  Edit3,
  Save,
  Plus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Copy,
  Check,
  Building2,
  UserCheck,
  Package,
  FileText,
} from "lucide-react";

interface Props {
  purchaseOrders: PurchaseOrderEntity[];
  canViewCost: boolean;
  onReceiveOrder: (order: PurchaseOrderEntity) => void;
  onGoToShortages?: () => void;
}

type OrderStatusFilter = "ALL" | PurchaseOrderStatus;

type OrderSortKey =
  | "createdAt"
  | "supplierName"
  | "status"
  | "itemsCount"
  | "progress"
  | "estimatedTotalAmount"
  | "createdByName";

const STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; badgeCls: string }
> = {
  DRAFT: {
    label: "مسودة",
    badgeCls: "bg-slate-800 text-slate-200 border-slate-700",
  },
  SENT: {
    label: "مُرسل للمستودع",
    badgeCls: "bg-sky-950 text-sky-300 border-sky-800",
  },
  PARTIAL: {
    label: "استلام جزئي",
    badgeCls: "bg-amber-950 text-amber-300 border-amber-800",
  },
  RECEIVED: {
    label: "مستلم بالكامل",
    badgeCls: "bg-emerald-950 text-emerald-300 border-emerald-800",
  },
  CANCELLED: {
    label: "ملغي",
    badgeCls: "bg-rose-950 text-rose-300 border-rose-800",
  },
};

const DISPATCH_CHANNEL_LABELS: Record<PurchaseOrderDispatchChannel, string> = {
  MANUAL: "تأكيد إرسال يدوي",
  MANUAL_WHATSAPP: "نسخ رسالة واتساب",
  WHATSAPP_LINK: "إرسال عبر واتساب",
  CSV_EXPORT: "تصدير ملف",
  API_AUTO: "إرسال تلقائي (API)",
};

const STATUS_FILTER_OPTIONS: readonly FilterPillOption<OrderStatusFilter>[] = [
  { id: "ALL", label: "الكل", tone: "slate" },
  { id: "DRAFT", label: "مسودة", tone: "slate" },
  { id: "SENT", label: "مُرسل", tone: "sky" },
  { id: "PARTIAL", label: "استلام جزئي", tone: "amber" },
  { id: "RECEIVED", label: "مستلم", tone: "emerald" },
  { id: "CANCELLED", label: "ملغي", tone: "rose" },
];

const ORDER_SORT_ACCESSORS: SortAccessors<PurchaseOrderEntity, OrderSortKey> = {
  createdAt: (o) => new Date(o.createdAt),
  supplierName: (o) => o.supplierName,
  status: (o) => STATUS_META[o.status].label,
  itemsCount: (o) => o.items.length,
  progress: (o) =>
    o.totalOrderedPacks > 0 ? o.totalReceivedPacks / o.totalOrderedPacks : 0,
  estimatedTotalAmount: (o) => o.estimatedTotalAmount,
  createdByName: (o) => o.createdByName || null,
};

const DEFAULT_ORDER_SORT: SortState<OrderSortKey> = {
  key: "createdAt",
  direction: "desc",
};

const ORDER_DEFAULT_DIRECTIONS: Partial<Record<OrderSortKey, SortDirection>> = {
  createdAt: "desc",
  supplierName: "asc",
  status: "asc",
  itemsCount: "desc",
  progress: "desc",
  estimatedTotalAmount: "desc",
  createdByName: "asc",
};

/**
 * تبويب متابعة وإدارة دورة حياة أوامر الشراء (Purchase Orders - PO)
 * يدعم إنشاء أمر شراء مباشر لأي مستودع، تعديل المسودات وإضافة أصناف حرة إليها،
 * الإرسال وإعادة الإرسال عبر واتساب، والتحويل بنقرة واحدة إلى فاتورة شراء.
 */
export const PurchaseOrdersTab: React.FC<Props> = ({
  purchaseOrders,
  canViewCost,
  onReceiveOrder,
  onGoToShortages,
}) => {
  const {
    products,
    suppliers,
    settings,
    createPurchaseOrdersBatch,
    updatePurchaseOrderItems,
    markPurchaseOrderSent,
    cancelPurchaseOrder,
    deleteDraftPurchaseOrder,
    setNotification,
  } = usePosStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("ALL");
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // حالة تعديل بنود وملاحظات أمر الشراء + الأصناف الحرة المضافة للمسودة (متاحة لـ DRAFT فقط)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [draftQtyMap, setDraftQtyMap] = useState<Record<string, number>>({});
  const [draftAddedItems, setDraftAddedItems] = useState<
    PurchaseOrderLineDraftInput[]
  >([]);
  const [draftNotes, setDraftNotes] = useState("");

  // حالة لوحة إنشاء أمر شراء جديد مباشر لأي مستودع وأي أصناف حرة
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [newOrderSupplierId, setNewOrderSupplierId] = useState("");
  const [useManualSupplierName, setUseManualSupplierName] = useState(false);
  const [manualSupplierName, setManualSupplierName] = useState("");
  const [manualSupplierPhone, setManualSupplierPhone] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [newOrderItems, setNewOrderItems] = useState<
    PurchaseOrderLineDraftInput[]
  >([]);
  const [savingNewOrder, setSavingNewOrder] = useState(false);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  // توليد رسالة الواتساب المنسّقة لأمر الشراء (للمتبقي في حالة الاستلام الجزئي أو كامل البنود)
  const buildOrderWhatsAppMessage = (order: PurchaseOrderEntity): string => {
    const requestItems = order.items
      .map((item) => {
        const remaining = Math.max(0, item.orderedPacks - item.receivedPacks);
        const qty = order.status === "PARTIAL" ? remaining : item.orderedPacks;
        return { item, qty };
      })
      .filter(({ qty }) => qty > 0);

    const baseMessage = buildWhatsAppOrderText({
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
      supplier: {
        name: order.supplierName,
        salesRepName: order.salesRepName,
      },
      items: requestItems.map(({ item, qty }) => ({
        name: item.productName,
        scientificName: item.scientificName || "",
        qty,
        unitLabel: "علبة",
        supplierName: order.supplierName,
      })),
    });

    const extraFooter = [
      `مرجع أمر الشراء: ${order.id}`,
      order.notes ? `ملاحظات: ${order.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return `${baseMessage}\n${extraFooter}`;
  };

  // جلب رقم هاتف المستودع من الأمر أو من دليل المستودعات الحالي كاحتياط
  const resolveOrderSupplierPhone = (
    order: PurchaseOrderEntity,
  ): string | undefined => {
    if (order.supplierPhone?.trim()) return order.supplierPhone.trim();
    const matched = suppliers.find(
      (s) =>
        (order.supplierId && s.id === order.supplierId) ||
        s.name.trim().toLowerCase() === order.supplierName.trim().toLowerCase(),
    );
    return matched?.phone?.trim() || undefined;
  };

  // إرسال أو إعادة إرسال أمر الشراء عبر واتساب ثم توثيق الحالة في SQLite
  const handleSendOrderViaWhatsApp = (order: PurchaseOrderEntity) => {
    const messageText = buildOrderWhatsAppMessage(order);
    const resolvedPhone = resolveOrderSupplierPhone(order);
    const directUrl = buildWhatsAppUrl(resolvedPhone, messageText);

    // فتح واتساب بشكل متزامن مع نقرة المستخدم لتجنب حظر النوافذ المنبثقة
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
    } else {
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      window.open(shareUrl, "_blank", "noopener,noreferrer");
      void navigator.clipboard.writeText(messageText).catch(() => {});
    }

    void markPurchaseOrderSent(order.id, "WHATSAPP_LINK");
  };

  // تعريف الأعمدة مع احترام صلاحية رؤية التكلفة canViewCost
  const orderColumns = useMemo<readonly TableColumnDef<OrderSortKey>[]>(() => {
    const cols: TableColumnDef<OrderSortKey>[] = [
      { id: "createdAt", label: "رقم الأمر والتاريخ", locked: true },
      { id: "supplierName", label: "المستودع / المندوب", locked: true },
      { id: "status", label: "الحالة" },
      { id: "itemsCount", label: "الأصناف" },
      { id: "progress", label: "المستلم / المطلوب" },
    ];
    if (canViewCost) {
      cols.push({ id: "estimatedTotalAmount", label: "القيمة التقديرية" });
    }
    cols.push({ id: "createdByName", label: "المنشئ" });
    return cols;
  }, [canViewCost]);

  const columnsState = useTableColumns("purchase_orders_table", orderColumns);

  // أعمدة تصدير الجدول إلى CSV/Excel مرتبطة بالأعمدة الظاهرة وصلاحية التكلفة
  const exportColumns = useMemo<
    readonly TableExportColumn<PurchaseOrderEntity, OrderSortKey>[]
  >(() => {
    const cols: TableExportColumn<PurchaseOrderEntity, OrderSortKey>[] = [
      {
        columnId: "createdAt",
        header: "رقم أمر الشراء",
        getValue: (o) => o.id,
      },
      {
        columnId: "createdAt",
        header: "تاريخ الإنشاء",
        getValue: (o) => o.createdAt.slice(0, 16).replace("T", " "),
      },
      {
        columnId: "supplierName",
        header: "المستودع",
        getValue: (o) => o.supplierName,
      },
      {
        columnId: "supplierName",
        header: "المندوب",
        getValue: (o) => o.salesRepName || "—",
      },
      {
        columnId: "status",
        header: "الحالة",
        getValue: (o) => STATUS_META[o.status].label,
      },
      {
        columnId: "itemsCount",
        header: "عدد الأصناف",
        getValue: (o) => o.items.length,
      },
      {
        columnId: "progress",
        header: "الكمية المطلوبة (علبة)",
        getValue: (o) => o.totalOrderedPacks,
      },
      {
        columnId: "progress",
        header: "الكمية المستلمة (علبة)",
        getValue: (o) => o.totalReceivedPacks,
      },
    ];

    if (canViewCost) {
      cols.push({
        columnId: "estimatedTotalAmount",
        header: "القيمة التقديرية (ر.س)",
        getValue: (o) => o.estimatedTotalAmount.toFixed(2),
      });
    }

    cols.push({
      columnId: "createdByName",
      header: "أنشئ بواسطة",
      getValue: (o) => o.createdByName || "غير موثّق",
    });

    return cols;
  }, [canViewCost]);

  // إحصائيات الملخص العلوي لأوامر الشراء
  const stats = useMemo(() => {
    let draftCount = 0;
    let awaitingCount = 0;
    let receivedCount = 0;
    let openEstimatedValue = 0;

    purchaseOrders.forEach((o) => {
      if (o.status === "DRAFT") draftCount += 1;
      else if (o.status === "SENT" || o.status === "PARTIAL")
        awaitingCount += 1;
      else if (o.status === "RECEIVED") receivedCount += 1;

      if (
        o.status === "DRAFT" ||
        o.status === "SENT" ||
        o.status === "PARTIAL"
      ) {
        const remainingVal = o.items.reduce((sum, it) => {
          const remaining = Math.max(0, it.orderedPacks - it.receivedPacks);
          return sum + remaining * it.estimatedUnitCost;
        }, 0);
        openEstimatedValue += remainingVal;
      }
    });

    return {
      draftCount,
      awaitingCount,
      receivedCount,
      openEstimatedValue,
    };
  }, [purchaseOrders]);

  // تصفية أوامر الشراء حسب الحالة ونطاق التواريخ ونص البحث
  const matchedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return purchaseOrders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!matchesDateRange(o.createdAt, dateRange)) return false;

      if (!q) return true;

      const matchesId = o.id.toLowerCase().includes(q);
      const matchesSupplier = o.supplierName.toLowerCase().includes(q);
      const matchesRep = (o.salesRepName || "").toLowerCase().includes(q);
      const matchesCreator = (o.createdByName || "").toLowerCase().includes(q);
      const matchesInvoice = o.linkedPurchaseInvoiceIds.some((invId) =>
        invId.toLowerCase().includes(q),
      );
      const matchesItem = o.items.some(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          it.barcode.includes(q) ||
          (it.scientificName || "").toLowerCase().includes(q),
      );

      return (
        matchesId ||
        matchesSupplier ||
        matchesRep ||
        matchesCreator ||
        matchesInvoice ||
        matchesItem
      );
    });
  }, [purchaseOrders, searchQuery, statusFilter, dateRange]);

  const {
    sortedItems: filteredOrders,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedOrders, {
    accessors: ORDER_SORT_ACCESSORS,
    defaultSort: DEFAULT_ORDER_SORT,
    defaultDirections: ORDER_DEFAULT_DIRECTIONS,
  });

  const pagination = useTablePagination(filteredOrders, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      statusFilter,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  const allExpanded =
    pagination.visibleItems.length > 0 &&
    pagination.visibleItems.every((o) => Boolean(expandedIds[o.id]));

  const toggleExpand = (orderId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    pagination.visibleItems.forEach((o) => {
      next[o.id] = true;
    });
    setExpandedIds(next);
  };

  // === إدارة تعديل مسودة أمر شراء قائمة وإضافة أصناف حرة إليها ===
  const startEditingOrder = (order: PurchaseOrderEntity) => {
    setShowCreatePanel(false);
    const qtyMap: Record<string, number> = {};
    order.items.forEach((it) => {
      qtyMap[it.id] = it.orderedPacks;
    });
    setEditingOrderId(order.id);
    setDraftQtyMap(qtyMap);
    setDraftAddedItems([]);
    setDraftNotes(order.notes || "");
    setExpandedIds((prev) => ({ ...prev, [order.id]: true }));
  };

  const cancelEditingOrder = () => {
    setEditingOrderId(null);
    setDraftQtyMap({});
    setDraftAddedItems([]);
    setDraftNotes("");
  };

  const handleAddFreeProductToEditingDraft = (
    order: PurchaseOrderEntity,
    product: ProductEntity,
  ) => {
    // إذا كان الصنف موجوداً في بنود المسودة الأصلية نزيد كميته مباشرة
    const existingItem = order.items.find((it) => it.productId === product.id);
    if (existingItem) {
      setDraftQtyMap((prev) => ({
        ...prev,
        [existingItem.id]:
          (prev[existingItem.id] ?? existingItem.orderedPacks) + 1,
      }));
      return;
    }

    // وإلا نضيفه إلى قائمة الأصناف المضافة أو نزيد كميته إن كان أُضيف في نفس الجلسة
    setDraftAddedItems((prev) => {
      const idx = prev.findIndex((it) => it.product.id === product.id);
      if (idx !== -1) {
        return prev.map((it, i) =>
          i === idx ? { ...it, orderedPacks: it.orderedPacks + 1 } : it,
        );
      }
      return [{ product, orderedPacks: 1 }, ...prev];
    });
  };

  const handleSaveOrderEdits = async (order: PurchaseOrderEntity) => {
    const updates = order.items.map((it) => ({
      itemId: it.id,
      orderedPacks:
        draftQtyMap[it.id] !== undefined ? draftQtyMap[it.id] : it.orderedPacks,
    }));
    await updatePurchaseOrderItems(
      order.id,
      updates,
      draftNotes,
      draftAddedItems,
    );
    cancelEditingOrder();
  };

  // === إدارة لوحة إنشاء أمر شراء مباشر جديد ===
  const handleToggleCreatePanel = () => {
    if (!showCreatePanel) {
      cancelEditingOrder();
      setUseManualSupplierName(activeSuppliers.length === 0);
    }
    setShowCreatePanel((prev) => !prev);
  };

  const resetCreatePanel = () => {
    setNewOrderSupplierId("");
    setUseManualSupplierName(activeSuppliers.length === 0);
    setManualSupplierName("");
    setManualSupplierPhone("");
    setNewOrderNotes("");
    setNewOrderItems([]);
  };

  const handleAddProductToNewOrder = (product: ProductEntity) => {
    setNewOrderItems((prev) => {
      const idx = prev.findIndex((it) => it.product.id === product.id);
      if (idx !== -1) {
        return prev.map((it, i) =>
          i === idx ? { ...it, orderedPacks: it.orderedPacks + 1 } : it,
        );
      }
      return [{ product, orderedPacks: 1 }, ...prev];
    });
  };

  const newOrderEstimatedTotal = useMemo(
    () =>
      newOrderItems.reduce(
        (sum, it) =>
          sum + it.orderedPacks * (it.product.weightedCostPrice || 0),
        0,
      ),
    [newOrderItems],
  );

  const handleCreateDirectOrder = async () => {
    if (savingNewOrder) return;

    const selectedSup = !useManualSupplierName
      ? activeSuppliers.find((s) => s.id === newOrderSupplierId) || null
      : null;

    const resolvedSupplierName = selectedSup
      ? selectedSup.name
      : manualSupplierName.trim();

    if (!resolvedSupplierName) {
      setNotification({
        type: "warning",
        message: "يرجى اختيار المستودع أو إدخال اسمه قبل حفظ أمر الشراء.",
      });
      return;
    }

    const validItems = newOrderItems.filter((it) => it.orderedPacks > 0);
    if (validItems.length === 0) {
      setNotification({
        type: "warning",
        message: "أضف صنفاً واحداً على الأقل بكمية أكبر من الصفر.",
      });
      return;
    }

    setSavingNewOrder(true);
    try {
      const created = await createPurchaseOrdersBatch([
        {
          supplierId: selectedSup?.id,
          supplierName: resolvedSupplierName,
          supplierPhone:
            selectedSup?.phone || manualSupplierPhone.trim() || undefined,
          salesRepName: selectedSup?.salesRepName,
          notes: newOrderNotes.trim() || undefined,
          items: validItems,
        },
      ]);

      if (created.length > 0) {
        resetCreatePanel();
        setShowCreatePanel(false);
        setExpandedIds((prev) => ({ ...prev, [created[0].id]: true }));
      }
    } finally {
      setSavingNewOrder(false);
    }
  };

  const handleCopyOrder = async (order: PurchaseOrderEntity) => {
    try {
      await navigator.clipboard.writeText(buildOrderWhatsAppMessage(order));
      setCopiedOrderId(order.id);
      window.setTimeout(() => {
        setCopiedOrderId((prev) => (prev === order.id ? null : prev));
      }, 2000);
    } catch {
      alert("تعذر النسخ إلى الحافظة.");
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وبطاقات الملخص وزر إنشاء أمر شراء مباشر */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-sky-400" /> سجل ومتابعة
            أوامر الشراء (Purchase Orders)
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            تتبع الطلبيات المعتمدة أو أنشئ أمراً مباشراً لأي مستودع، وأرسلها عبر
            واتساب مع متابعة الاستلام الجزئي والكلي.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleToggleCreatePanel}
            className={`font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 shadow transition ${
              showCreatePanel
                ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                : "bg-amber-600 hover:bg-amber-500 text-white"
            }`}
          >
            {showCreatePanel ? (
              <>
                <X className="w-4 h-4" /> إغلاق نموذج الأمر الجديد
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> أمر شراء جديد مباشر
              </>
            )}
          </button>

          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">مسودات</div>
            <div className="font-mono font-bold text-slate-200 text-sm">
              {stats.draftCount}
            </div>
          </div>

          <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-sky-300/80">بانتظار الاستلام</div>
            <div className="font-mono font-extrabold text-sky-400 text-sm">
              {stats.awaitingCount}
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-emerald-300/80">مستلم بالكامل</div>
            <div className="font-mono font-extrabold text-emerald-400 text-sm">
              {stats.receivedCount}
            </div>
          </div>

          {canViewCost && (
            <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-amber-300/80">
                تقديري متبقٍ مفتوح
              </div>
              <div className="font-mono font-extrabold text-amber-300 text-sm">
                {stats.openEstimatedValue.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* لوحة إنشاء أمر شراء مباشر بأصناف حرة (خارج دفتر النواقص) */}
      {showCreatePanel && (
        <div className="bg-slate-950 border border-amber-700/60 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="font-bold text-amber-300 text-xs flex items-center gap-2">
              <Plus className="w-4 h-4" />
              إنشاء أمر شراء مباشر (يمكنك طلب أي دواء حتى لو لم يصل لحد النقص)
            </div>
            <button
              type="button"
              onClick={() => setShowCreatePanel(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* اختيار المستودع والملاحظات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 text-[11px]">
                  المستودع / المورد *
                </label>
                {activeSuppliers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseManualSupplierName((prev) => !prev);
                      setNewOrderSupplierId("");
                      setManualSupplierName("");
                    }}
                    className="text-[10.5px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    {useManualSupplierName
                      ? "الاختيار من الدليل"
                      : "+ إدخال اسم يدوي"}
                  </button>
                )}
              </div>

              {!useManualSupplierName && activeSuppliers.length > 0 ? (
                <select
                  value={newOrderSupplierId}
                  onChange={(e) => setNewOrderSupplierId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- اختر المستودع من الدليل --</option>
                  {activeSuppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                      {sup.salesRepName ? ` (${sup.salesRepName})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={manualSupplierName}
                  onChange={(e) => setManualSupplierName(e.target.value)}
                  placeholder="اسم المستودع أو الشركة..."
                  className={inputCls}
                />
              )}
            </div>

            {useManualSupplierName && (
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">
                  رقم واتساب المستودع (اختياري)
                </label>
                <input
                  type="text"
                  value={manualSupplierPhone}
                  onChange={(e) => setManualSupplierPhone(e.target.value)}
                  placeholder="مثال: 9639xxxxxxxx"
                  className={`${inputCls} font-mono`}
                />
              </div>
            )}

            <div className={useManualSupplierName ? "" : "md:col-span-2"}>
              <label className="block text-slate-400 text-[11px] mb-1">
                ملاحظات الطلبية (عرض بونص / طلب مستعجل...)
              </label>
              <input
                type="text"
                value={newOrderNotes}
                onChange={(e) => setNewOrderNotes(e.target.value)}
                placeholder="ملاحظة اختيارية تُرفق في رسالة الطلبية..."
                className={inputCls}
              />
            </div>
          </div>

          {/* شريط البحث والباركود الموحّد لإدراج أي صنف حر */}
          <ProductQuickPicker
            products={products}
            onSelectProduct={handleAddProductToNewOrder}
            showCost={canViewCost}
            enableBarcodeScanner={showCreatePanel && !editingOrderId}
            enableF2Shortcut={showCreatePanel && !editingOrderId}
            accent="indigo"
            inputBgClass="bg-slate-900"
            actionLabel="إضافة للأمر"
            placeholder="امسح الباركود أو ابحث بالاسم أو المادة الفعالة لإضافة أي صنف لأمر الشراء..."
          />

          {/* قائمة الأصناف المختارة للأمر الجديد */}
          {newOrderItems.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                      <th className="py-2 px-3">الدواء والباركود</th>
                      <th className="py-2 px-2 text-center">الرصيد الحالي</th>
                      <th className="py-2 px-2 text-center">
                        الكمية المطلوبة (علبة)
                      </th>
                      {canViewCost && (
                        <th className="py-2 px-3 text-left">تقديري</th>
                      )}
                      <th className="py-2 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {newOrderItems.map((entry) => (
                      <tr key={entry.product.id}>
                        <td className="py-2 px-3">
                          <div className="font-bold text-white">
                            {entry.product.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {entry.product.scientificName} |{" "}
                            <span className="font-mono">
                              {entry.product.barcode}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-300">
                          {entry.product.stockPacks} علبة
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min={1}
                            value={entry.orderedPacks}
                            onChange={(e) => {
                              const nextQty = Math.max(
                                1,
                                Number(e.target.value) || 1,
                              );
                              setNewOrderItems((prev) =>
                                prev.map((it) =>
                                  it.product.id === entry.product.id
                                    ? { ...it, orderedPacks: nextQty }
                                    : it,
                                ),
                              );
                            }}
                            className="w-20 bg-slate-950 border border-amber-700/70 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-amber-400"
                          />
                        </td>
                        {canViewCost && (
                          <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                            {(
                              entry.orderedPacks *
                              (entry.product.weightedCostPrice || 0)
                            ).toFixed(2)}{" "}
                            ر.س
                          </td>
                        )}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setNewOrderItems((prev) =>
                                prev.filter(
                                  (it) => it.product.id !== entry.product.id,
                                ),
                              )
                            }
                            title="حذف الصنف"
                            className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* تذييل حفظ الأمر المباشر */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono">
              عدد الأصناف: <b className="text-white">{newOrderItems.length}</b>
              {canViewCost && newOrderItems.length > 0 && (
                <span className="mr-3">
                  التقديري:{" "}
                  <b className="text-amber-300">
                    {newOrderEstimatedTotal.toFixed(2)} ر.س
                  </b>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetCreatePanel();
                  setShowCreatePanel(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={newOrderItems.length === 0 || savingNewOrder}
                onClick={() => void handleCreateDirectOrder()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold inline-flex items-center gap-1.5 shadow transition"
              >
                <Save className="w-4 h-4" />
                حفظ كمسودة أمر شراء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الجدول الموحّد بصفوف قابلة للتوسيع */}
      <DataTableShell
        framed={false}
        totalCount={purchaseOrders.length}
        filteredCount={filteredOrders.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: ClipboardCheck,
          title: "لا توجد أوامر شراء مسجلة بعد",
          description:
            "يمكنك إنشاء أمر شراء مباشر من الزر أعلاه، أو اعتماد أصناف دفتر النواقص كأوامر شراء منظمة لكل مستودع.",
          action: (
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleCreatePanel}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                إنشاء أمر شراء مباشر
              </button>
              {onGoToShortages && (
                <button
                  type="button"
                  onClick={onGoToShortages}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl transition"
                >
                  الانتقال إلى دفتر النواقص
                </button>
              )}
            </div>
          ),
        }}
        noResultsState={{
          description:
            "لا توجد أوامر شراء مطابقة لمعايير البحث أو الفلاتر الحالية.",
        }}
        toolbar={
          purchaseOrders.length > 0 ? (
            <DataTableToolbar
              accent="sky"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="ابحث برقم الأمر (PO-...)، المستودع، المندوب، الدواء، أو رقم فاتورة الشراء المرتبطة..."
              filters={
                <FilterPills
                  variant="segmented"
                  options={STATUS_FILTER_OPTIONS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  ariaLabel="تصفية حسب حالة أمر الشراء"
                />
              }
              secondaryFilters={
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  accent="sky"
                />
              }
              secondaryActions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent="sky"
                  />

                  {pagination.visibleItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleExpandAll}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5 text-sky-400" />
                      {allExpanded ? "طي الكل" : "توسيع الكل"}
                    </button>
                  )}

                  <TableExportButton
                    items={filteredOrders}
                    columns={exportColumns}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix="Purchase_Orders"
                    itemLabel="أمر شراء"
                  />
                </>
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredOrders.length}
              totalCount={purchaseOrders.length}
              itemLabel="أمر شراء"
              metaExtra={
                <span className="text-[10.5px] text-slate-500 hidden md:inline">
                  اضغط على أي صف لعرض الأصناف وتعديل المسودة أو إضافة أصناف حرة
                </span>
              }
            />
          ) : undefined
        }
        header={
          <tr>
            {columnsState.isVisible("createdAt") && (
              <SortableTh
                direction={getSortDirection("createdAt")}
                onSort={() => toggleSort("createdAt")}
                accent="sky"
              >
                رقم الأمر والتاريخ
              </SortableTh>
            )}
            {columnsState.isVisible("supplierName") && (
              <SortableTh
                direction={getSortDirection("supplierName")}
                onSort={() => toggleSort("supplierName")}
                accent="sky"
              >
                المستودع / المندوب
              </SortableTh>
            )}
            {columnsState.isVisible("status") && (
              <SortableTh
                direction={getSortDirection("status")}
                onSort={() => toggleSort("status")}
                align="center"
                accent="sky"
              >
                الحالة
              </SortableTh>
            )}
            {columnsState.isVisible("itemsCount") && (
              <SortableTh
                direction={getSortDirection("itemsCount")}
                onSort={() => toggleSort("itemsCount")}
                align="center"
                accent="sky"
              >
                الأصناف
              </SortableTh>
            )}
            {columnsState.isVisible("progress") && (
              <SortableTh
                direction={getSortDirection("progress")}
                onSort={() => toggleSort("progress")}
                align="center"
                accent="sky"
              >
                المستلم / المطلوب
              </SortableTh>
            )}
            {canViewCost && columnsState.isVisible("estimatedTotalAmount") && (
              <SortableTh
                direction={getSortDirection("estimatedTotalAmount")}
                onSort={() => toggleSort("estimatedTotalAmount")}
                align="center"
                accent="sky"
              >
                القيمة التقديرية
              </SortableTh>
            )}
            {columnsState.isVisible("createdByName") && (
              <SortableTh
                direction={getSortDirection("createdByName")}
                onSort={() => toggleSort("createdByName")}
                accent="sky"
              >
                المنشئ
              </SortableTh>
            )}
            <th className="py-2.5 px-3 text-left">إجراءات</th>
          </tr>
        }
        footer={
          <TableLoadMoreFooter
            visibleCount={pagination.visibleCount}
            totalCount={pagination.totalCount}
            remainingCount={pagination.remainingCount}
            pageSize={pagination.pageSize}
            hasMore={pagination.hasMore}
            onLoadMore={pagination.loadMore}
            onShowAll={pagination.showAll}
            itemLabel="أمر شراء"
            accent="sky"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((order) => {
          const isExpanded = Boolean(expandedIds[order.id]);
          const isEditing = editingOrderId === order.id;
          const statusMeta = STATUS_META[order.status];
          const canReceive =
            order.status === "DRAFT" ||
            order.status === "SENT" ||
            order.status === "PARTIAL";
          const canSendOrResend =
            order.status === "DRAFT" ||
            order.status === "SENT" ||
            order.status === "PARTIAL";
          const isResend = order.status !== "DRAFT";
          const progressPercent =
            order.totalOrderedPacks > 0
              ? Math.min(
                  100,
                  Math.round(
                    (order.totalReceivedPacks / order.totalOrderedPacks) * 100,
                  ),
                )
              : 0;

          return (
            <React.Fragment key={order.id}>
              <tr
                onClick={() => toggleExpand(order.id)}
                className={`cursor-pointer transition ${
                  isExpanded
                    ? "bg-sky-950/25"
                    : "bg-slate-950/40 hover:bg-slate-800/55"
                }`}
              >
                {columnsState.isVisible("createdAt") && (
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono font-extrabold text-white">
                        {order.id}
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-0.5 pr-5">
                      {new Date(order.createdAt).toLocaleString("ar-SA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </td>
                )}

                {columnsState.isVisible("supplierName") && (
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-100 inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{order.supplierName}</span>
                    </div>
                    {(order.salesRepName || order.supplierPhone) && (
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        {order.salesRepName && (
                          <span>{order.salesRepName}</span>
                        )}
                        {order.supplierPhone && (
                          <span className="font-mono text-slate-500">
                            {order.supplierPhone}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                )}

                {columnsState.isVisible("status") && (
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${statusMeta.badgeCls}`}
                    >
                      {statusMeta.label}
                    </span>
                  </td>
                )}

                {columnsState.isVisible("itemsCount") && (
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">
                    {order.items.length} صنف
                  </td>
                )}

                {columnsState.isVisible("progress") && (
                  <td className="py-3 px-3 text-center">
                    <div className="font-mono font-bold text-slate-200 text-[11px]">
                      {order.totalReceivedPacks} / {order.totalOrderedPacks}{" "}
                      علبة
                    </div>
                    <div className="w-24 mx-auto h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all ${
                          progressPercent >= 100
                            ? "bg-emerald-500"
                            : progressPercent > 0
                              ? "bg-amber-400"
                              : "bg-slate-600"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </td>
                )}

                {canViewCost &&
                  columnsState.isVisible("estimatedTotalAmount") && (
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-amber-300">
                      {order.estimatedTotalAmount.toFixed(2)} ر.س
                    </td>
                  )}

                {columnsState.isVisible("createdByName") && (
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      {order.createdByName || "غير موثّق"}
                    </span>
                  </td>
                )}

                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {/* زر تأكيد الإرسال عبر واتساب للمسودات، ويتحول إلى زر إعادة إرسال بعد الإرسال */}
                    {canSendOrResend && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendOrderViaWhatsApp(order);
                        }}
                        title={
                          isResend
                            ? "إعادة إرسال الطلبية إلى المستودع عبر واتساب"
                            : "إرسال الطلبية إلى واتساب المستودع وتحديث الحالة إلى مُرسل"
                        }
                        className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition ${
                          isResend
                            ? "bg-emerald-950/70 hover:bg-emerald-700 border border-emerald-700/80 text-emerald-300 hover:text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                        }`}
                      >
                        {isResend ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            إعادة إرسال
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            تأكيد الإرسال
                          </>
                        )}
                      </button>
                    )}

                    {canReceive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReceiveOrder(order);
                        }}
                        title="تحويل الأصناف المتبقية مباشرةً إلى فاتورة شراء"
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        استلام كفاتورة
                      </button>
                    )}

                    {order.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `هل تريد حذف مسودة أمر الشراء (${order.id})؟`,
                            )
                          ) {
                            void deleteDraftPurchaseOrder(order.id);
                          }
                        }}
                        title="حذف المسودة"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(order.status === "SENT" ||
                      order.status === "PARTIAL") && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `هل تريد إلغاء أمر الشراء (${order.id}) وأرشفته؟`,
                            )
                          ) {
                            void cancelPurchaseOrder(order.id);
                          }
                        }}
                        title="إلغاء أمر الشراء"
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-700 border border-rose-800/70 text-rose-300 hover:text-white transition"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span
                      className={`px-2 py-1.5 rounded-lg border text-[10.5px] font-bold ${
                        isExpanded
                          ? "bg-sky-950/70 border-sky-700 text-sky-200"
                          : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      {isExpanded ? "إخفاء" : "التفاصيل"}
                    </span>
                  </div>
                </td>
              </tr>

              {/* تفاصيل أمر الشراء الموسّعة */}
              {isExpanded && (
                <tr className="bg-slate-950/90">
                  <td colSpan={columnsState.visibleCount + 1} className="p-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                      {/* شريط معلومات التتبع وأزرار التعديل والنسخ */}
                      <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 text-[11px]">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-bold text-slate-200 inline-flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-sky-400" />
                            أصناف أمر الشراء (
                            {order.items.length +
                              (isEditing ? draftAddedItems.length : 0)}
                            )
                          </span>
                          {order.sentAt && (
                            <span className="text-sky-300 text-[10.5px]">
                              آخر إرسال:{" "}
                              <b className="font-mono">
                                {new Date(order.sentAt).toLocaleString("ar-SA")}
                              </b>
                              {order.dispatchChannel && (
                                <span className="text-slate-400 mr-1">
                                  (
                                  {
                                    DISPATCH_CHANNEL_LABELS[
                                      order.dispatchChannel
                                    ]
                                  }
                                  )
                                </span>
                              )}
                            </span>
                          )}
                          {order.completedAt && (
                            <span className="text-emerald-300 text-[10.5px]">
                              اكتمل الاستلام:{" "}
                              <b className="font-mono">
                                {new Date(order.completedAt).toLocaleString(
                                  "ar-SA",
                                )}
                              </b>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void handleCopyOrder(order)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                          >
                            {copiedOrderId === order.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                تم النسخ
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-sky-400" />
                                نسخ نص الطلبية
                              </>
                            )}
                          </button>

                          {order.status === "DRAFT" && !isEditing && (
                            <button
                              type="button"
                              onClick={() => startEditingOrder(order)}
                              className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              تعديل وإضافة أصناف حرة
                            </button>
                          )}

                          {isEditing && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveOrderEdits(order)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                              >
                                <Save className="w-3.5 h-3.5" />
                                حفظ التعديلات
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingOrder}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                                إلغاء
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* شريط إضافة أصناف حرة إلى المسودة أثناء التعديل */}
                      {isEditing && (
                        <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2">
                          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            إضافة صنف حر إلى هذه المسودة (بالباركود أو البحث):
                          </div>
                          <ProductQuickPicker
                            products={products}
                            onSelectProduct={(prod) =>
                              handleAddFreeProductToEditingDraft(order, prod)
                            }
                            showCost={canViewCost}
                            enableBarcodeScanner={isEditing}
                            enableF2Shortcut={isEditing}
                            accent="indigo"
                            inputBgClass="bg-slate-900"
                            actionLabel="إضافة للمسودة"
                            placeholder="امسح الباركود أو ابحث عن أي دواء لإضافته لمسودة أمر الشراء..."
                          />
                        </div>
                      )}

                      {/* جدول بنود أمر الشراء */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                              <th className="py-2 px-3">الدواء والباركود</th>
                              <th className="py-2 px-2 text-center">المطلوب</th>
                              <th className="py-2 px-2 text-center">المستلم</th>
                              <th className="py-2 px-2 text-center">المتبقي</th>
                              {canViewCost && (
                                <>
                                  <th className="py-2 px-2 text-center">
                                    تكلفة تقديرية
                                  </th>
                                  <th className="py-2 px-3 text-left">
                                    إجمالي السطر
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {/* الأصناف الحرة المضافة حديثاً قبل الحفظ */}
                            {isEditing &&
                              draftAddedItems.map((added) => {
                                const unitCost =
                                  added.product.weightedCostPrice || 0;
                                const lineEst = added.orderedPacks * unitCost;
                                return (
                                  <tr
                                    key={`added-${added.product.id}`}
                                    className="bg-amber-950/20"
                                  >
                                    <td className="py-2 px-3">
                                      <div className="font-bold text-amber-200 flex items-center gap-1.5">
                                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-600/30 border border-amber-500/60 text-amber-200">
                                          جديد
                                        </span>
                                        <span>{added.product.name}</span>
                                      </div>
                                      <div className="text-[9.5px] text-slate-400 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono">
                                          {added.product.barcode}
                                        </span>
                                        {added.product.scientificName && (
                                          <span>
                                            — {added.product.scientificName}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <div className="inline-flex items-center gap-1">
                                        <input
                                          type="number"
                                          min={1}
                                          value={added.orderedPacks}
                                          onChange={(e) => {
                                            const val = Math.max(
                                              1,
                                              Number(e.target.value) || 1,
                                            );
                                            setDraftAddedItems((prev) =>
                                              prev.map((it) =>
                                                it.product.id ===
                                                added.product.id
                                                  ? { ...it, orderedPacks: val }
                                                  : it,
                                              ),
                                            );
                                          }}
                                          className="w-16 bg-slate-950 border border-amber-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-amber-400"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDraftAddedItems((prev) =>
                                              prev.filter(
                                                (it) =>
                                                  it.product.id !==
                                                  added.product.id,
                                              ),
                                            )
                                          }
                                          title="إزالة الصنف المضاف"
                                          className="p-1 rounded bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 transition"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-slate-500">
                                      0 علبة
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-amber-300">
                                      {added.orderedPacks} علبة
                                    </td>
                                    {canViewCost && (
                                      <>
                                        <td className="py-2 px-2 text-center font-mono text-slate-300">
                                          {unitCost.toFixed(2)}
                                        </td>
                                        <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                                          {lineEst.toFixed(2)} ر.س
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}

                            {/* بنود الأمر المحفوظة */}
                            {order.items.map((item) => {
                              const currentQty = isEditing
                                ? (draftQtyMap[item.id] ?? item.orderedPacks)
                                : item.orderedPacks;
                              const remaining = Math.max(
                                0,
                                currentQty - item.receivedPacks,
                              );
                              const lineEst =
                                currentQty * item.estimatedUnitCost;

                              return (
                                <tr
                                  key={item.id}
                                  className="hover:bg-slate-800/35"
                                >
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-slate-100">
                                      {item.productName}
                                    </div>
                                    <div className="text-[9.5px] text-slate-500 flex items-center gap-2 flex-wrap">
                                      <span className="font-mono">
                                        {item.barcode}
                                      </span>
                                      {item.scientificName && (
                                        <span>— {item.scientificName}</span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-2 px-2 text-center">
                                    {isEditing ? (
                                      <div className="inline-flex items-center gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          value={currentQty}
                                          onChange={(e) =>
                                            setDraftQtyMap((prev) => ({
                                              ...prev,
                                              [item.id]: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                              ),
                                            }))
                                          }
                                          className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-sky-500"
                                        />
                                        <span className="text-[10px] text-slate-500">
                                          (0 للحذف)
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-mono font-bold text-white">
                                        {item.orderedPacks} علبة
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
                                    {item.receivedPacks} علبة
                                  </td>

                                  <td className="py-2 px-2 text-center font-mono font-bold">
                                    <span
                                      className={
                                        remaining > 0
                                          ? "text-amber-300"
                                          : "text-slate-500"
                                      }
                                    >
                                      {remaining} علبة
                                    </span>
                                  </td>

                                  {canViewCost && (
                                    <>
                                      <td className="py-2 px-2 text-center font-mono text-slate-300">
                                        {item.estimatedUnitCost.toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                                        {lineEst.toFixed(2)} ر.س
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* الملاحظات وفواتير الشراء المرتبطة */}
                      <div className="px-3.5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex-1 min-w-[220px] space-y-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={draftNotes}
                              onChange={(e) => setDraftNotes(e.target.value)}
                              placeholder="أضف ملاحظة لأمر الشراء (اختياري)..."
                              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-sky-500"
                            />
                          ) : (
                            order.notes && (
                              <div className="text-[11px] text-slate-400">
                                <b className="text-slate-300">ملاحظات:</b>{" "}
                                {order.notes}
                              </div>
                            )
                          )}

                          {order.linkedPurchaseInvoiceIds.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                              <span className="text-slate-400 inline-flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                فواتير الاستلام المرتبطة:
                              </span>
                              {order.linkedPurchaseInvoiceIds.map((invId) => (
                                <span
                                  key={invId}
                                  className="font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                                >
                                  {invId}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {canReceive && !isEditing && (
                          <button
                            type="button"
                            onClick={() => onReceiveOrder(order)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            {order.status === "PARTIAL"
                              ? "استلام الأصناف المتبقية كفاتورة شراء"
                              : "استلام وإنشاء فاتورة شراء"}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </DataTableShell>
    </div>
  );
};
