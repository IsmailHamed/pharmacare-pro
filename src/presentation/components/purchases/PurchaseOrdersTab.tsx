import React, { useMemo, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { PurchaseOrderEntity } from "../../../domain/entities";
import { buildWhatsAppUrl } from "../../../domain/utils/whatsappHelper";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPills } from "../common/table/FilterPills";
import { useTableSort } from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { useTableColumns } from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import { TableExportButton } from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  DEFAULT_ORDER_SORT,
  ORDER_DEFAULT_DIRECTIONS,
  ORDER_SORT_ACCESSORS,
  OrderStatusFilter,
  STATUS_FILTER_OPTIONS,
  STATUS_META,
  buildOrderWhatsAppMessage,
  computePurchaseOrdersStats,
  getOrderExportColumns,
  getOrderTableColumns,
  resolveOrderSupplierPhone,
} from "./orders/purchaseOrders.config";
import { DirectPurchaseOrderPanel } from "./orders/DirectPurchaseOrderPanel";
import { PurchaseOrderExpandedRow } from "./orders/PurchaseOrderExpandedRow";
import {
  Ban,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  ClipboardCheck,
  PackageCheck,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

interface Props {
  purchaseOrders: PurchaseOrderEntity[];
  canViewCost: boolean;
  onReceiveOrder: (order: PurchaseOrderEntity) => void;
  onGoToShortages?: () => void;
}

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
    markPurchaseOrderSent,
    cancelPurchaseOrder,
    deleteDraftPurchaseOrder,
  } = usePosStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("ALL");
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  const orderColumns = useMemo(
    () => getOrderTableColumns(canViewCost),
    [canViewCost],
  );
  const columnsState = useTableColumns("purchase_orders_table", orderColumns);

  const exportColumns = useMemo(
    () => getOrderExportColumns(canViewCost),
    [canViewCost],
  );

  const stats = useMemo(
    () => computePurchaseOrdersStats(purchaseOrders),
    [purchaseOrders],
  );

  // إرسال أو إعادة إرسال أمر الشراء عبر واتساب ثم توثيق الحالة في SQLite
  const handleSendOrderViaWhatsApp = (order: PurchaseOrderEntity) => {
    const messageText = buildOrderWhatsAppMessage(order, settings);
    const resolvedPhone = resolveOrderSupplierPhone(order, suppliers);
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

  const handleCopyOrder = async (order: PurchaseOrderEntity) => {
    try {
      await navigator.clipboard.writeText(
        buildOrderWhatsAppMessage(order, settings),
      );
      setCopiedOrderId(order.id);
      window.setTimeout(() => {
        setCopiedOrderId((prev) => (prev === order.id ? null : prev));
      }, 2000);
    } catch {
      alert("تعذر النسخ إلى الحافظة.");
    }
  };

  // تصفية أوامر الشراء حسب الحالة ونطاق التواريخ ونص البحث
  const matchedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return purchaseOrders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!matchesDateRange(o.createdAt, dateRange)) return false;
      if (!q) return true;

      return (
        o.id.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        (o.salesRepName || "").toLowerCase().includes(q) ||
        (o.createdByName || "").toLowerCase().includes(q) ||
        o.linkedPurchaseInvoiceIds.some((invId) =>
          invId.toLowerCase().includes(q),
        ) ||
        o.items.some(
          (it) =>
            it.productName.toLowerCase().includes(q) ||
            it.barcode.includes(q) ||
            (it.scientificName || "").toLowerCase().includes(q),
        )
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
    setExpandedIds((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
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

  const handleToggleCreatePanel = () => {
    if (!showCreatePanel) setEditingOrderId(null);
    setShowCreatePanel((prev) => !prev);
  };

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

      {/* لوحة إنشاء أمر شراء مباشر بأصناف حرة */}
      {showCreatePanel && (
        <DirectPurchaseOrderPanel
          products={products}
          activeSuppliers={activeSuppliers}
          canViewCost={canViewCost}
          isScannerEnabled={showCreatePanel && !editingOrderId}
          onClose={() => setShowCreatePanel(false)}
          onCreated={(createdOrderId) =>
            setExpandedIds((prev) => ({ ...prev, [createdOrderId]: true }))
          }
        />
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
          const canSendOrResend = canReceive;
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
                <PurchaseOrderExpandedRow
                  order={order}
                  colSpan={columnsState.visibleCount + 1}
                  products={products}
                  canViewCost={canViewCost}
                  canReceive={canReceive}
                  isEditing={isEditing}
                  isCopied={copiedOrderId === order.id}
                  onCopyOrder={(target) => void handleCopyOrder(target)}
                  onStartEdit={() => {
                    setShowCreatePanel(false);
                    setEditingOrderId(order.id);
                    setExpandedIds((prev) => ({ ...prev, [order.id]: true }));
                  }}
                  onCancelEdit={() => setEditingOrderId(null)}
                  onReceiveOrder={onReceiveOrder}
                />
              )}
            </React.Fragment>
          );
        })}
      </DataTableShell>
    </div>
  );
};
