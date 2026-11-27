import {
  PurchaseOrderDispatchChannel,
  PurchaseOrderEntity,
  PurchaseOrderStatus,
  SupplierEntity,
} from "../../../../domain/entities";
import { buildWhatsAppOrderText } from "../../../../domain/utils/whatsappHelper";
import { FilterPillOption } from "../../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
} from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";

export type OrderStatusFilter = "ALL" | PurchaseOrderStatus;

export type OrderSortKey =
  | "createdAt"
  | "supplierName"
  | "status"
  | "itemsCount"
  | "progress"
  | "estimatedTotalAmount"
  | "createdByName";

export const STATUS_META: Record<
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

export const DISPATCH_CHANNEL_LABELS: Record<
  PurchaseOrderDispatchChannel,
  string
> = {
  MANUAL: "تأكيد إرسال يدوي",
  MANUAL_WHATSAPP: "نسخ رسالة واتساب",
  WHATSAPP_LINK: "إرسال عبر واتساب",
  CSV_EXPORT: "تصدير ملف",
  API_AUTO: "إرسال تلقائي (API)",
};

export const STATUS_FILTER_OPTIONS: readonly FilterPillOption<OrderStatusFilter>[] =
  [
    { id: "ALL", label: "الكل", tone: "slate" },
    { id: "DRAFT", label: "مسودة", tone: "slate" },
    { id: "SENT", label: "مُرسل", tone: "sky" },
    { id: "PARTIAL", label: "استلام جزئي", tone: "amber" },
    { id: "RECEIVED", label: "مستلم", tone: "emerald" },
    { id: "CANCELLED", label: "ملغي", tone: "rose" },
  ];

export const ORDER_SORT_ACCESSORS: SortAccessors<
  PurchaseOrderEntity,
  OrderSortKey
> = {
  createdAt: (o) => new Date(o.createdAt),
  supplierName: (o) => o.supplierName,
  status: (o) => STATUS_META[o.status].label,
  itemsCount: (o) => o.items.length,
  progress: (o) =>
    o.totalOrderedPacks > 0 ? o.totalReceivedPacks / o.totalOrderedPacks : 0,
  estimatedTotalAmount: (o) => o.estimatedTotalAmount,
  createdByName: (o) => o.createdByName || null,
};

export const DEFAULT_ORDER_SORT: SortState<OrderSortKey> = {
  key: "createdAt",
  direction: "desc",
};

export const ORDER_DEFAULT_DIRECTIONS: Partial<
  Record<OrderSortKey, SortDirection>
> = {
  createdAt: "desc",
  supplierName: "asc",
  status: "asc",
  itemsCount: "desc",
  progress: "desc",
  estimatedTotalAmount: "desc",
  createdByName: "asc",
};

// تعريف الأعمدة مع احترام صلاحية رؤية التكلفة canViewCost
export const getOrderTableColumns = (
  canViewCost: boolean,
): readonly TableColumnDef<OrderSortKey>[] => {
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
};

// أعمدة تصدير الجدول إلى CSV/Excel مرتبطة بالأعمدة الظاهرة وصلاحية التكلفة
export const getOrderExportColumns = (
  canViewCost: boolean,
): readonly TableExportColumn<PurchaseOrderEntity, OrderSortKey>[] => {
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
};

// توليد رسالة الواتساب المنسّقة لأمر الشراء (للمتبقي في حالة الاستلام الجزئي أو كامل البنود)
export const buildOrderWhatsAppMessage = (
  order: PurchaseOrderEntity,
  pharmacy: { pharmacyName: string; phone?: string },
): string => {
  const requestItems = order.items
    .map((item) => {
      const remaining = Math.max(0, item.orderedPacks - item.receivedPacks);
      const qty = order.status === "PARTIAL" ? remaining : item.orderedPacks;
      return { item, qty };
    })
    .filter(({ qty }) => qty > 0);

  const baseMessage = buildWhatsAppOrderText({
    pharmacyName: pharmacy.pharmacyName || "",
    pharmacyPhone: pharmacy.phone ?? "",
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
export const resolveOrderSupplierPhone = (
  order: PurchaseOrderEntity,
  suppliers: SupplierEntity[],
): string | undefined => {
  if (order.supplierPhone?.trim()) return order.supplierPhone.trim();
  const matched = suppliers.find(
    (s) =>
      (order.supplierId && s.id === order.supplierId) ||
      s.name.trim().toLowerCase() === order.supplierName.trim().toLowerCase(),
  );
  return matched?.phone?.trim() || undefined;
};

// حساب إحصائيات الملخص العلوي لأوامر الشراء
export const computePurchaseOrdersStats = (
  purchaseOrders: PurchaseOrderEntity[],
) => {
  let draftCount = 0;
  let awaitingCount = 0;
  let receivedCount = 0;
  let openEstimatedValue = 0;

  purchaseOrders.forEach((o) => {
    if (o.status === "DRAFT") draftCount += 1;
    else if (o.status === "SENT" || o.status === "PARTIAL") awaitingCount += 1;
    else if (o.status === "RECEIVED") receivedCount += 1;

    if (o.status === "DRAFT" || o.status === "SENT" || o.status === "PARTIAL") {
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
};
