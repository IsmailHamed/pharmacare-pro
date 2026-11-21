import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SupplierEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { CURRENT_BRANCH_ID } from "../../../infrastructure/db/database";
import {
  Building2,
  X,
  Plus,
  Search,
  Phone,
  User,
  StickyNote,
  Edit3,
  Power,
  CheckCircle2,
  Ban,
  Save,
  RotateCcw,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

/**
 * نافذة إدارة دليل المستودعات والموردين (إضافة، تعديل، بحث، وتفعيل/تجميد)
 */
export const SuppliersManagerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { suppliers, addOrUpdateSupplier, toggleSupplierStatus } =
    usePosStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [salesRepName, setSalesRepName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setSalesRepName("");
    setNotes("");
  };

  // تهيئة النموذج والتركيز التلقائي عند فتح النافذة
  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    setSearchQuery("");
    setStatusFilter("ALL");
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const activeCount = useMemo(
    () => suppliers.filter((s) => s.isActive).length,
    [suppliers],
  );
  const inactiveCount = suppliers.length - activeCount;

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter((sup) => {
      if (statusFilter === "ACTIVE" && !sup.isActive) return false;
      if (statusFilter === "INACTIVE" && sup.isActive) return false;
      if (!q) return true;
      return (
        sup.name.toLowerCase().includes(q) ||
        (sup.phone || "").toLowerCase().includes(q) ||
        (sup.salesRepName || "").toLowerCase().includes(q) ||
        (sup.notes || "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, searchQuery, statusFilter]);

  if (!isOpen) return null;

  const handleStartEdit = (supplier: SupplierEntity) => {
    setEditingId(supplier.id);
    setName(supplier.name);
    setPhone(supplier.phone || "");
    setSalesRepName(supplier.salesRepName || "");
    setNotes(supplier.notes || "");
    window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const existing = editingId
        ? suppliers.find((s) => s.id === editingId)
        : undefined;

      const supplierPayload: SupplierEntity = {
        id: existing
          ? existing.id
          : `SUP-${uuidv4().slice(0, 8).toUpperCase()}`,
        name: name.trim(),
        phone: phone.trim() || undefined,
        salesRepName: salesRepName.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive: existing ? existing.isActive : true,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        branchId: existing ? existing.branchId : CURRENT_BRANCH_ID,
      };

      const saved = await addOrUpdateSupplier(supplierPayload);
      if (saved) {
        resetForm();
        nameInputRef.current?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl p-2.5 text-white outline-none transition";

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[86vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">
              إدارة دليل المستودعات والموردين
            </h3>
            <span className="bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
              نشط: {activeCount}
            </span>
            {inactiveCount > 0 && (
              <span className="bg-slate-900 border border-slate-700 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded-full">
                مجمّد: {inactiveCount}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="إغلاق (Esc)"
            className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-700 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم النافذة المقسوم: نموذج الإضافة/التعديل يميناً + قائمة المستودعات يساراً */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* العمود الأيمن: نموذج إضافة أو تعديل مستودع */}
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="lg:col-span-5 p-4 bg-slate-950/70 border-b lg:border-b-0 lg:border-l border-slate-800 space-y-3.5 overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                {editingId ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-400" />
                    تعديل بيانات المستودع
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-indigo-400" />
                    إضافة مستودع جديد
                  </>
                )}
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg transition"
                >
                  <RotateCcw className="w-3 h-3" /> إلغاء التعديل
                </button>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                اسم المستودع / المورد *
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مستودع الشفاء للأدوية"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                رقم الهاتف / واتساب الطلبيات
              </label>
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9639XXXXXXXX أو 09XXXXXXXX"
                className={`${inputCls} font-mono text-right`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                يُستخدم لتجهيز رابط إرسال طلبية النواقص مباشرةً عبر واتساب.
              </p>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                اسم المندوب (اختياري)
              </label>
              <input
                type="text"
                value={salesRepName}
                onChange={(e) => setSalesRepName(e.target.value)}
                placeholder="مثال: أ. سامر الأحمد"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                ملاحظات التوزيع والطلب (اختياري)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: التوزيع أيام الأحد والثلاثاء — بونص مميز على المضادات..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className={`w-full font-bold py-2.5 rounded-xl text-white flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition ${
                editingId
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
            >
              {editingId ? (
                <>
                  <Save className="w-4 h-4" /> حفظ تعديلات المستودع
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> حفظ وإضافة إلى الدليل
                </>
              )}
            </button>
          </form>

          {/* العمود الأيسر: البحث وقائمة المستودعات المحفوظة */}
          <div className="lg:col-span-7 p-4 flex flex-col overflow-hidden space-y-3">
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المستودع، المندوب، أو الهاتف..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pr-9 pl-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(
                  [
                    { id: "ALL", label: `الكل (${suppliers.length})` },
                    { id: "ACTIVE", label: `نشط (${activeCount})` },
                    { id: "INACTIVE", label: `مجمّد (${inactiveCount})` },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatusFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      statusFilter === pill.id
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {suppliers.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-500 text-center gap-2">
                  <Building2 className="w-10 h-10 text-slate-700 stroke-1" />
                  <p className="font-bold text-slate-400">
                    لا توجد مستودعات مسجلة في الدليل حتى الآن
                  </p>
                  <p className="text-[11px] max-w-xs">
                    أضف مستودعاتك المعتمدة من النموذج المجاور لتتمكن من توزيع
                    طلبيات النواقص واختيارها بسرعة عند إدخال فواتير الشراء.
                  </p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  لا توجد مستودعات مطابقة لخيارات البحث أو الفلترة الحالية.
                </div>
              ) : (
                filteredSuppliers.map((sup) => {
                  const isBeingEdited = editingId === sup.id;
                  return (
                    <div
                      key={sup.id}
                      className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                        isBeingEdited
                          ? "bg-amber-950/25 border-amber-500/70"
                          : sup.isActive
                            ? "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                            : "bg-slate-950/40 border-slate-800/70 opacity-70"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs">
                            {sup.name}
                          </span>
                          {sup.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                              <Ban className="w-3 h-3" /> مجمّد
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
                          {sup.phone && (
                            <span className="inline-flex items-center gap-1 font-mono text-sky-300">
                              <Phone className="w-3 h-3" />
                              <span dir="ltr">{sup.phone}</span>
                            </span>
                          )}
                          {sup.salesRepName && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {sup.salesRepName}
                            </span>
                          )}
                        </div>

                        {sup.notes && (
                          <div className="text-[10.5px] text-slate-400 flex items-start gap-1 pt-0.5">
                            <StickyNote className="w-3 h-3 text-amber-400/80 shrink-0 mt-0.5" />
                            <span>{sup.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(sup)}
                          title="تعديل بيانات المستودع"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-amber-600 border border-slate-700 text-slate-300 hover:text-white transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleSupplierStatus(sup.id)}
                          title={
                            sup.isActive
                              ? "تجميد المستودع (إخفاء من الطلبيات الجديدة)"
                              : "إعادة تفعيل المستودع"
                          }
                          className={`p-2 rounded-lg border transition ${
                            sup.isActive
                              ? "bg-slate-800 hover:bg-rose-700 border-slate-700 text-rose-400 hover:text-white"
                              : "bg-emerald-950/60 hover:bg-emerald-600 border-emerald-800 text-emerald-300 hover:text-white"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
