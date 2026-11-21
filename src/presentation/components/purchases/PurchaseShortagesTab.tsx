import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProductEntity, SupplierEntity } from "../../../domain/entities";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../../domain/utils/fuzzySearch";
import { usePosStore } from "../../../application/store/usePosStore";
import { ProductSearchInput } from "../common/ProductSearchInput";
import {
  ClipboardList,
  FileSpreadsheet,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  RotateCcw,
  Settings2,
  MessageCircle,
  CheckSquare,
  ChevronDown,
  CheckCircle2,
  X,
} from "lucide-react";

interface Props {
  shortageProducts: ProductEntity[];
  canViewCost: boolean;
  onOpenSuppliersModal: () => void;
}

const PAGE_SIZE = 50;
const ASSIGNED_KEY = "__ASSIGNED__";
const UNASSIGNED_KEY = "__UNASSIGNED__";

const getSuggestedQty = (product: ProductEntity): number =>
  Math.max(5, product.minLimit * 2 - product.stockPacks);

const csvCell = (value: string | number): string =>
  `"${String(value).replace(/"/g, '""')}"`;

const sanitizeWhatsAppPhone = (phone?: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^00/, "");
};

/**
 * تبويب دفتر النواقص وتوزيع الطلبيات على المستودعات (Purchase Orders)
 * يستخدم نفس محرك البحث الضبابي والصوتي (fuzzySearch) وشريط البحث الموحّد في نقطة البيع
 */
export const PurchaseShortagesTab: React.FC<Props> = ({
  shortageProducts,
  canViewCost,
  onOpenSuppliersModal,
}) => {
  const { settings, suppliers, setNotification } = usePosStore();

  const [orderQtyMap, setOrderQtyMap] = useState<Record<string, number>>({});
  // خريطة مؤقتة لجلسة الطلب فقط: productId -> supplierId
  const [assignedSupplierMap, setAssignedSupplierMap] = useState<
    Record<string, string>
  >({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkSupplierId, setBulkSupplierId] = useState<string>("");
  const [activeSupplierFilter, setActiveSupplierFilter] =
    useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // بناء فهرس البحث الضبابي والصوتي لأصناف النواقص مرة واحدة عند تغيّر القائمة
  const shortageSearchIndex = useMemo(
    () => buildProductSearchIndex(shortageProducts),
    [shortageProducts],
  );

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  const suppliersById = useMemo(() => {
    const map = new Map<string, SupplierEntity>();
    suppliers.forEach((s) => map.set(s.id, s));
    return map;
  }, [suppliers]);

  // اختصار F2 (أو / خارج حقول الإدخال) للتركيز السريع على خانة البحث في النواقص
  useEffect(() => {
    const handleFocusShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "F2" || (e.key === "/" && !isEditable)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleFocusShortcut);
    return () => window.removeEventListener("keydown", handleFocusShortcut);
  }, []);

  // تهيئة الكميات المقترحة وتنظيف التحديدات والتعيينات للأصناف التي خرجت من قائمة النواقص
  useEffect(() => {
    const shortageIdSet = new Set(shortageProducts.map((p) => p.id));

    setOrderQtyMap((prev) => {
      const next: Record<string, number> = {};
      shortageProducts.forEach((p) => {
        next[p.id] = prev[p.id] !== undefined ? prev[p.id] : getSuggestedQty(p);
      });
      return next;
    });

    setAssignedSupplierMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([pid, sid]) => {
        if (shortageIdSet.has(pid) && sid) {
          next[pid] = sid;
        }
      });
      return next;
    });

    setSelectedIds((prev) => {
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([pid, checked]) => {
        if (checked && shortageIdSet.has(pid)) {
          next[pid] = true;
        }
      });
      return next;
    });
  }, [shortageProducts]);

  // إبقاء الفلتر النشط صالحاً في حال تغيّر الدليل
  useEffect(() => {
    if (
      activeSupplierFilter !== "ALL" &&
      activeSupplierFilter !== ASSIGNED_KEY &&
      activeSupplierFilter !== UNASSIGNED_KEY &&
      !suppliersById.has(activeSupplierFilter)
    ) {
      setActiveSupplierFilter("ALL");
      setVisibleLimit(PAGE_SIZE);
    }
  }, [activeSupplierFilter, suppliersById]);

  const getOrderQty = (product: ProductEntity): number =>
    orderQtyMap[product.id] !== undefined
      ? orderQtyMap[product.id]
      : getSuggestedQty(product);

  const getAssignedSupplierId = (productId: string): string => {
    const sid = assignedSupplierMap[productId];
    return sid && suppliersById.has(sid) ? sid : "";
  };

  // حساب عدادات الأصناف لكل مستودع + الموزعة + غير الموزعة
  const supplierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let assigned = 0;
    let unassigned = 0;

    shortageProducts.forEach((p) => {
      const sid = assignedSupplierMap[p.id];
      if (sid && suppliersById.has(sid)) {
        counts[sid] = (counts[sid] || 0) + 1;
        assigned++;
      } else {
        unassigned++;
      }
    });

    return { counts, assigned, unassigned };
  }, [shortageProducts, assignedSupplierMap, suppliersById]);

  // المستودعات التي تظهر في شريط التصفية: النشطة + أي مستودع مجمّد لا يزال له أصناف موزعة في الجلسة
  const filterSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) => s.isActive || (supplierCounts.counts[s.id] || 0) > 0,
    );
  }, [suppliers, supplierCounts]);

  const outOfStockCount = useMemo(
    () => shortageProducts.filter((p) => p.stockPacks === 0).length,
    [shortageProducts],
  );

  // الأصناف ضمن نطاق فلتر المستودع الحالي (تُستخدم للنسخ والتصدير بالكامل)
  const scopedShortages = useMemo(() => {
    return shortageProducts.filter((p) => {
      const sid = getAssignedSupplierId(p.id);
      if (activeSupplierFilter === "ALL") return true;
      if (activeSupplierFilter === ASSIGNED_KEY) return Boolean(sid);
      if (activeSupplierFilter === UNASSIGNED_KEY) return !sid;
      return sid === activeSupplierFilter;
    });
  }, [
    shortageProducts,
    activeSupplierFilter,
    assignedSupplierMap,
    suppliersById,
  ]);

  // تصفية إضافية للعرض باستخدام محرك البحث الضبابي والصوتي مع الحفاظ على ترتيب الدقة
  const filteredShortages = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return scopedShortages;

    const scopedIdSet = new Set(scopedShortages.map((p) => p.id));
    return searchProductsFuzzy(
      shortageSearchIndex,
      q,
      Math.max(shortageProducts.length, 60),
    ).filter((p) => scopedIdSet.has(p.id));
  }, [
    scopedShortages,
    shortageSearchIndex,
    shortageProducts.length,
    searchQuery,
  ]);

  // اقتصاص العناصر المرئية بـ 50 صنفاً لمنع ثقل الـ DOM عند كثرة النواقص
  const visibleShortages = useMemo(
    () => filteredShortages.slice(0, visibleLimit),
    [filteredShortages, visibleLimit],
  );

  // الأصناف الجاهزة للطلب ضمن النطاق الحالي (ذات الكمية > 0)
  const activeOrderItems = useMemo(
    () =>
      scopedShortages
        .map((product) => ({
          product,
          qty:
            orderQtyMap[product.id] !== undefined
              ? orderQtyMap[product.id]
              : getSuggestedQty(product),
          supplier: getAssignedSupplierId(product.id)
            ? suppliersById.get(getAssignedSupplierId(product.id)) || null
            : null,
        }))
        .filter((entry) => entry.qty > 0),
    [scopedShortages, orderQtyMap, assignedSupplierMap, suppliersById],
  );

  const selectedSupplier = useMemo(
    () =>
      activeSupplierFilter !== "ALL" &&
      activeSupplierFilter !== ASSIGNED_KEY &&
      activeSupplierFilter !== UNASSIGNED_KEY
        ? suppliersById.get(activeSupplierFilter) || null
        : null,
    [activeSupplierFilter, suppliersById],
  );

  const selectedSupplierWhatsAppPhone = useMemo(
    () => sanitizeWhatsAppPhone(selectedSupplier?.phone),
    [selectedSupplier],
  );

  // التكلفة التقديرية للنطاق الحالي (تُعرض فقط لحاملي صلاحية canViewCost)
  const totalEstimatedCost = useMemo(
    () =>
      activeOrderItems.reduce(
        (sum, { product, qty }) => sum + qty * product.weightedCostPrice,
        0,
      ),
    [activeOrderItems],
  );

  const selectedProductIdsList = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id]),
    [selectedIds],
  );

  const allVisibleSelected =
    visibleShortages.length > 0 &&
    visibleShortages.every((p) => Boolean(selectedIds[p.id]));

  const handleSelectSupplierFilter = (filterId: string) => {
    setActiveSupplierFilter(filterId);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = { ...prev };
        visibleShortages.forEach((p) => {
          delete next[p.id];
        });
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = { ...prev };
      visibleShortages.forEach((p) => {
        next[p.id] = true;
      });
      return next;
    });
  };

  const handleAssignSingle = (productId: string, supplierId: string) => {
    setAssignedSupplierMap((prev) => {
      const next = { ...prev };
      if (!supplierId) {
        delete next[productId];
      } else {
        next[productId] = supplierId;
      }
      return next;
    });
  };

  const handleApplyBulkAssign = () => {
    if (selectedProductIdsList.length === 0) return;

    setAssignedSupplierMap((prev) => {
      const next = { ...prev };
      selectedProductIdsList.forEach((pid) => {
        if (!bulkSupplierId || bulkSupplierId === UNASSIGNED_KEY) {
          delete next[pid];
        } else {
          next[pid] = bulkSupplierId;
        }
      });
      return next;
    });

    const targetLabel =
      !bulkSupplierId || bulkSupplierId === UNASSIGNED_KEY
        ? "إلغاء التعيين"
        : suppliersById.get(bulkSupplierId)?.name || "المستودع المحدد";

    setNotification({
      type: "success",
      message: `تم توجيه (${selectedProductIdsList.length}) صنف إلى: ${targetLabel}.`,
    });
    setSelectedIds({});
  };

  const handleResetSuggested = () => {
    const resetMap: Record<string, number> = {};
    shortageProducts.forEach((p) => {
      resetMap[p.id] = getSuggestedQty(p);
    });
    setOrderQtyMap(resetMap);
  };

  // بناء نص طلبية واتساب نظيف (خاص بالمستودع المختار أو مجمّع حسب المستودعات)
  const buildWhatsAppOrderText = (): string => {
    const dateStr = new Date().toLocaleDateString("ar-SA");

    if (selectedSupplier) {
      const lines = activeOrderItems.map(
        ({ product, qty }, idx) =>
          `${idx + 1}. ${product.name} (${product.scientificName}) — المطلوب: [${qty} علبة]`,
      );

      return [
        `📋 *طلبية نواقص أدوية - ${settings.pharmacyName}*`,
        `التاريخ: ${dateStr}`,
        `إلى السادة: *${selectedSupplier.name}*${
          selectedSupplier.salesRepName
            ? ` (المندوب: ${selectedSupplier.salesRepName})`
            : ""
        }`,
        `--------------------------------`,
        ...lines,
        `--------------------------------`,
        `إجمالي الأصناف المطلوبة: ${lines.length} صنف`,
        `هاتف الصيدلية: ${settings.phone}`,
      ].join("\n");
    }

    // حالة عرض الكل أو الموزعة أو غير الموزعة: تجميع البنود حسب المستودع
    const grouped = new Map<
      string,
      Array<{ product: ProductEntity; qty: number }>
    >();

    activeOrderItems.forEach(({ product, qty, supplier }) => {
      const groupName = supplier ? supplier.name : "أصناف غير موزعة على مستودع";
      const list = grouped.get(groupName) || [];
      list.push({ product, qty });
      grouped.set(groupName, list);
    });

    const blocks: string[] = [];
    grouped.forEach((items, groupName) => {
      const lines = items.map(
        ({ product, qty }, idx) =>
          `  ${idx + 1}. ${product.name} (${product.scientificName}) — [${qty} علبة]`,
      );
      blocks.push(
        `📦 *${groupName}* (${items.length} صنف):\n${lines.join("\n")}`,
      );
    });

    return [
      `📋 *طلبيات نواقص أدوية - ${settings.pharmacyName}*`,
      `التاريخ: ${dateStr}`,
      `--------------------------------`,
      ...blocks,
      `--------------------------------`,
      `إجمالي الأصناف المطلوبة: ${activeOrderItems.length} صنف`,
      `هاتف الصيدلية: ${settings.phone}`,
    ].join("\n");
  };

  const handleCopyWhatsApp = async () => {
    if (activeOrderItems.length === 0) return;
    const text = buildWhatsAppOrderText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: selectedSupplier
        ? `تم نسخ طلبية (${selectedSupplier.name}) بنجاح! يمكنك لصقها في واتساب المندوب.`
        : "تم نسخ نص طلبية النواقص بنجاح! يمكنك لصقها في واتساب مباشرة.",
    });
  };

  const handleOpenWhatsAppDirect = () => {
    if (activeOrderItems.length === 0 || !selectedSupplierWhatsAppPhone) return;
    const text = buildWhatsAppOrderText();
    const url = `https://wa.me/${selectedSupplierWhatsAppPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // تصدير ملف CSV متوافق مع Excel بالترميز العربي (UTF-8 BOM)
  const handleExportCsvOrder = () => {
    if (activeOrderItems.length === 0) return;

    const headers = [
      "المستودع المحدد",
      "الباركود",
      "الاسم التجاري للدواء",
      "المادة الفعالة",
      "الرصيد الحالي (علبة)",
      "حد الطلب الأدنى",
      "الكمية المطلوبة (علبة)",
      ...(canViewCost
        ? ["آخر تكلفة مرجحة للعلبة", "التكلفة التقديرية للسطر"]
        : []),
    ];

    const rows = activeOrderItems.map(({ product, qty, supplier }) => {
      const baseColumns: (string | number)[] = [
        csvCell(supplier?.name || "غير محدد"),
        csvCell(product.barcode),
        csvCell(product.name),
        csvCell(product.scientificName),
        product.stockPacks,
        product.minLimit,
        qty,
      ];

      if (canViewCost) {
        baseColumns.push(
          product.weightedCostPrice.toFixed(2),
          (qty * product.weightedCostPrice).toFixed(2),
        );
      }

      return baseColumns.join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    const safeSupplierSlug = selectedSupplier
      ? `_${selectedSupplier.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}`
      : "";
    link.href = url;
    link.download = `Purchase_Order${safeSupplierSlug}_${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: "success",
      message: selectedSupplier
        ? `تم تصدير طلبية (${selectedSupplier.name}) بنجاح.`
        : `تم تصدير ملف طلبية النواقص (Purchase_Order_${datePart}.csv) بنجاح.`,
    });
  };

  const currentScopeLabel = selectedSupplier
    ? selectedSupplier.name
    : activeSupplierFilter === ASSIGNED_KEY
      ? "الأصناف الموزعة على المستودعات"
      : activeSupplierFilter === UNASSIGNED_KEY
        ? "الأصناف غير الموزعة"
        : "كافة النواقص (مجمّعة حسب المستودع)";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وملخص النواقص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" /> دفتر النواقص
            وتوزيع طلبيات المستودعات
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            وزّع الأصناف الناقصة على المستودعات وقت الطلب، ثم انسخ أو أرسل طلبية
            كل مستودع بشكل مستقل عبر واتساب أو Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">أصناف تحت الحد</div>
            <div className="font-mono font-bold text-sky-300 text-sm">
              {shortageProducts.length}
            </div>
          </div>

          {outOfStockCount > 0 && (
            <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-rose-300/80">
                نفد بالكامل (0)
              </div>
              <div className="font-mono font-extrabold text-rose-400 text-sm">
                {outOfStockCount}
              </div>
            </div>
          )}

          {canViewCost && (
            <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-amber-300/80">
                {selectedSupplier
                  ? `تقديري (${selectedSupplier.name})`
                  : "التكلفة التقديرية للنطاق"}
              </div>
              <div className="font-mono font-extrabold text-amber-400 text-sm">
                {totalEstimatedCost.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* تنبيه يظهر فقط عند عدم وجود مستودعات مضافة في الدليل بعد */}
      {activeSuppliers.length === 0 && (
        <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-200">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              لم تضف أي مستودعات إلى الدليل بعد — أضف مستودعاتك لتتمكن من تقسيم
              الطلبيات وإرسالها لكل مستودع على حدة.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSuppliersModal}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shrink-0 transition"
          >
            <Settings2 className="w-3.5 h-3.5" /> إضافة المستودعات الآن
          </button>
        </div>
      )}

      {/* شريط حبوب الفلترة (الكل / الموزعة / غير موزعة / المستودعات) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectSupplierFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
              activeSupplierFilter === "ALL"
                ? "bg-slate-700 border-slate-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <span>الكل</span>
            <span className="font-mono text-[10px] bg-black/30 px-1.5 rounded-full">
              {shortageProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSupplierFilter(ASSIGNED_KEY)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
              activeSupplierFilter === ASSIGNED_KEY
                ? "bg-emerald-950/85 border-emerald-500 text-emerald-200"
                : "bg-slate-900 border-slate-800 text-emerald-400 hover:border-emerald-800"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>الموزعة</span>
            <span className="font-mono text-[10px] bg-black/30 px-1.5 rounded-full">
              {supplierCounts.assigned}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSupplierFilter(UNASSIGNED_KEY)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
              activeSupplierFilter === UNASSIGNED_KEY
                ? "bg-amber-950/85 border-amber-500 text-amber-200"
                : "bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-800"
            }`}
          >
            <span>غير موزعة</span>
            <span className="font-mono text-[10px] bg-black/30 px-1.5 rounded-full">
              {supplierCounts.unassigned}
            </span>
          </button>

          {filterSuppliers.map((sup) => {
            const count = supplierCounts.counts[sup.id] || 0;
            const isSelected = activeSupplierFilter === sup.id;
            return (
              <button
                key={sup.id}
                type="button"
                onClick={() => handleSelectSupplierFilter(sup.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-400 text-white shadow"
                    : count > 0
                      ? "bg-indigo-950/50 border-indigo-800/80 text-indigo-200 hover:border-indigo-600"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>{sup.name}</span>
                <span className="font-mono text-[10px] bg-black/30 px-1.5 rounded-full">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* شريط أزرار الإرسال والتصدير للنطاق المختار */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-slate-400">
            نطاق الطلبية الحالي:{" "}
            <b className="text-white">{currentScopeLabel}</b> —{" "}
            <span className="font-mono text-sky-400">
              {activeOrderItems.length} صنف جاهز للطلب
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedSupplier && selectedSupplierWhatsAppPhone && (
              <button
                type="button"
                disabled={activeOrderItems.length === 0}
                onClick={handleOpenWhatsAppDirect}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
              >
                <MessageCircle className="w-4 h-4" /> إرسال مباشر لواتساب
                المستودع
              </button>
            )}

            <button
              type="button"
              disabled={activeOrderItems.length === 0}
              onClick={() => void handleCopyWhatsApp()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> تم النسخ للواتساب!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> نسخ للواتساب (
                  {activeOrderItems.length})
                </>
              )}
            </button>

            <button
              type="button"
              disabled={activeOrderItems.length === 0}
              onClick={handleExportCsvOrder}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير Excel / CSV
            </button>
          </div>
        </div>
      </div>

      {/* شريط التوجيه الجماعي عند تحديد أصناف بمربعات الاختيار */}
      {selectedProductIdsList.length > 0 && (
        <div className="bg-indigo-950/45 border border-indigo-700/80 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-indigo-200 font-bold">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span>
              تم تحديد{" "}
              <b className="font-mono text-white">
                {selectedProductIdsList.length}
              </b>{" "}
              صنف — توجيهها دفعة واحدة إلى:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkSupplierId}
              onChange={(e) => setBulkSupplierId(e.target.value)}
              className="bg-slate-900 border border-indigo-700 rounded-lg px-3 py-1.5 text-white outline-none min-w-[200px]"
            >
              <option value="">-- اختر المستودع --</option>
              {activeSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
              <option value={UNASSIGNED_KEY}>إلغاء التعيين (غير موزع)</option>
            </select>

            <button
              type="button"
              disabled={!bulkSupplierId}
              onClick={handleApplyBulkAssign}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg transition"
            >
              تطبيق التوجيه
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds({})}
              title="إلغاء التحديد"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* شريط البحث الموحّد داخل النواقص + عداد المعروض + إعادة ضبط الكميات المقترحة */}
      {shortageProducts.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex-wrap">
          <ProductSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            resultsCount={filteredShortages.length}
            accent="sky"
            inputBgClass="bg-slate-900"
            shortcutHint="F2"
            placeholder="ابحث في النواقص بالباركود أو الاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة... (F2)"
            className="flex-1 min-w-[260px]"
          />

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <span className="text-slate-400 font-mono">
              يعرض <b className="text-white">{visibleShortages.length}</b> من{" "}
              <b className="text-amber-400">{filteredShortages.length}</b> • ضمن
              الطلبية: <b className="text-sky-400">{activeOrderItems.length}</b>
            </span>
            <button
              type="button"
              onClick={handleResetSuggested}
              title="إعادة تعيين جميع الكميات للقيمة المقترحة تلقائياً"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-2 rounded-xl font-bold flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              الكميات المقترحة
            </button>
          </div>
        </div>
      )}

      {/* جدول النواقص وتحديد المستودع لكل صنف (محدود بـ visibleLimit لأداء فائق) */}
      {shortageProducts.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
          <ClipboardList className="w-9 h-9 text-emerald-500/50 stroke-1" />
          <p className="text-sm font-bold text-emerald-400">
            ممتاز! لا توجد أي نواقص تحت حد الطلب في الصيدلية حالياً.
          </p>
        </div>
      ) : filteredShortages.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد أصناف ناقصة مطابقة لفلتر المستودع أو عبارة البحث الحالية.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-950">
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleToggleSelectAllVisible}
                      title="تحديد كل الأصناف المعروضة حالياً"
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-2">الدواء / المادة الفعالة</th>
                  <th className="py-2.5 px-2 text-center">الرصيد / الحد</th>
                  <th className="py-2.5 px-2 min-w-[190px]">
                    المستودع الموجه له الطلب
                  </th>
                  {canViewCost && (
                    <th className="py-2.5 px-2 text-center">آخر تكلفة</th>
                  )}
                  <th className="py-2.5 px-2 text-center">
                    الكمية المطلوبة (علبة)
                  </th>
                  {canViewCost && (
                    <th className="py-2.5 px-3 text-left">الإجمالي التقديري</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/35">
                {visibleShortages.map((p) => {
                  const qty = getOrderQty(p);
                  const assignedId = getAssignedSupplierId(p.id);
                  const isChecked = Boolean(selectedIds[p.id]);
                  const assignedSupplierObj = assignedId
                    ? suppliersById.get(assignedId)
                    : undefined;

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        isChecked ? "bg-indigo-950/30" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedIds((prev) => ({
                              ...prev,
                              [p.id]: e.target.checked,
                            }))
                          }
                          className="rounded accent-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-2">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {p.stockPacks === 0 && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.scientificName} |{" "}
                          <span className="font-mono">{p.barcode}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            p.stockPacks === 0
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {p.stockPacks} / {p.minLimit}
                        </span>
                      </td>

                      <td className="py-2.5 px-2">
                        <select
                          value={assignedId}
                          onChange={(e) =>
                            handleAssignSingle(p.id, e.target.value)
                          }
                          className={`w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border transition ${
                            assignedId
                              ? "bg-indigo-950/40 border-indigo-700 text-indigo-100 font-bold"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                          }`}
                        >
                          <option
                            value=""
                            className="bg-slate-900 text-slate-400"
                          >
                            — غير محدد —
                          </option>
                          {activeSuppliers.map((sup) => (
                            <option
                              key={sup.id}
                              value={sup.id}
                              className="bg-slate-900 text-white"
                            >
                              {sup.name}
                            </option>
                          ))}
                          {assignedSupplierObj &&
                            !assignedSupplierObj.isActive && (
                              <option
                                value={assignedSupplierObj.id}
                                className="bg-slate-900 text-slate-400"
                              >
                                {assignedSupplierObj.name} (مجمّد)
                              </option>
                            )}
                        </select>
                      </td>

                      {canViewCost && (
                        <td className="py-2.5 px-2 text-center font-mono text-amber-400">
                          {p.weightedCostPrice.toFixed(2)}
                        </td>
                      )}

                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={qty}
                          onChange={(e) =>
                            setOrderQtyMap((prev) => ({
                              ...prev,
                              [p.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-20 bg-slate-800 border border-sky-700 rounded-lg p-1.5 text-center font-mono font-bold text-white outline-none focus:border-sky-400"
                        />
                      </td>

                      {canViewCost && (
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-400">
                          {(qty * p.weightedCostPrice).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* زر تحميل 50 صنفاً إضافياً كما في شاشة المخزون */}
          {filteredShortages.length > visibleLimit && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-6 py-2.5 rounded-xl inline-flex items-center gap-2 shadow transition"
              >
                <ChevronDown className="w-4 h-4 text-sky-400" />
                عرض {PAGE_SIZE} صنفاً إضافياً (المتبقي:{" "}
                {filteredShortages.length - visibleLimit} صنف)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
