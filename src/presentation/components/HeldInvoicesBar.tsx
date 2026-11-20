import React from "react";
import { HeldInvoiceEntity } from "../../domain/entities";
import { FileText, PauseCircle, Plus, UserCheck } from "lucide-react";

interface Props {
  heldInvoices: HeldInvoiceEntity[];
  onResume: (id: string) => void;
  activeCustomerName?: string;
  activeCartCount?: number;
  activeCartTotal?: number;
  onHoldCurrent?: () => void;
  invoicesCount?: number;
  onOpenHistory?: () => void;
}

/**
 * شريط تبويبات الزبائن والفواتير المعلقة (Multi-Customer Tabs) + زر سجل الفواتير المدمج
 * يعرض تبويب الزبون النشط + التبويبات المعلقة المرقّمة مع اختصارات Alt+1..Alt+9
 */
export const HeldInvoicesBar: React.FC<Props> = ({
  heldInvoices,
  onResume,
  activeCustomerName = "",
  activeCartCount = 0,
  activeCartTotal = 0,
  onHoldCurrent,
  invoicesCount = 0,
  onOpenHistory,
}) => {
  // إخفاء الشريط فقط إذا لم يكن زر سجل الفواتير مدمجاً فيه وكانت السلة والتبويبات فارغة
  if (!onOpenHistory && heldInvoices.length === 0 && activeCartCount === 0) {
    return null;
  }

  const activeLabel = activeCustomerName.trim() || "الزبون الحالي";

  return (
    <div className="bg-slate-950/90 border-b border-slate-800 px-4 pt-1.5 flex items-end justify-between gap-2 text-[11px]">
      {/* الجانب الأيمن: تبويب الزبون النشط + الفواتير المعلقة + زر زبون جديد */}
      <div className="flex items-end gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
        {/* تبويب الزبون النشط حالياً */}
        <div className="shrink-0 bg-slate-900 border-t-2 border-x border-t-emerald-500 border-x-slate-700 text-white rounded-t-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold max-w-[140px] truncate">
            {activeLabel}
          </span>
          {activeCartCount > 0 ? (
            <span className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-[10px] px-1.5 py-0.2 rounded">
              {activeCartCount} صنف • {activeCartTotal.toFixed(2)}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">(سلة جاهزة)</span>
          )}
        </div>

        {/* ألسنة التبويب المرقّمة للفواتير المعلقة (Alt+1 .. Alt+9) */}
        {heldInvoices.map((inv, idx) => {
          const tabNumber = idx + 1;
          const heldTotal = inv.items.reduce(
            (sum, item) => sum + item.unitPrice * item.qty,
            0,
          );
          const shortcutLabel = tabNumber <= 9 ? `Alt+${tabNumber}` : null;

          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => onResume(inv.id)}
              title={
                shortcutLabel
                  ? `اضغط أو استخدم (${shortcutLabel}) للتبديل إلى ${inv.customerName} (سيتم تعليق السلة الحالية تلقائياً إن لم تكن فارغة)`
                  : `استئناف فاتورة ${inv.customerName}`
              }
              className="group shrink-0 bg-amber-950/35 hover:bg-amber-900/55 border-t border-x border-amber-800/70 hover:border-amber-600 text-amber-200 rounded-t-lg px-3 py-1.5 flex items-center gap-2 transition"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold max-w-[130px] truncate">
                {inv.customerName}
              </span>
              <span className="bg-slate-900/80 border border-amber-900/80 text-amber-300/90 font-mono text-[10px] px-1.5 py-0.2 rounded">
                {inv.items.length} صنف • {heldTotal.toFixed(0)} ر.س
              </span>
              {shortcutLabel && (
                <kbd className="bg-slate-900 group-hover:bg-amber-950 border border-amber-700/70 text-amber-300 font-mono text-[9px] px-1.5 py-0.5 rounded">
                  {shortcutLabel}
                </kbd>
              )}
            </button>
          );
        })}

        {/* زر سريع لتعليق الزبون الحالي وفتح تبويب لزبون جديد (F5) */}
        {onHoldCurrent && activeCartCount > 0 && (
          <button
            type="button"
            onClick={onHoldCurrent}
            title="تعليق الفاتورة الحالية وبدء فاتورة لزبون جديد (F5)"
            className="shrink-0 mb-1 mr-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg px-2.5 py-1 font-bold flex items-center gap-1 transition text-[10px]"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            زبون جديد
            <kbd className="bg-slate-900 border border-slate-700 text-slate-400 font-mono text-[9px] px-1 rounded">
              F5
            </kbd>
          </button>
        )}
      </div>

      {/* الجانب الأيسر: زر سجل الفواتير المدمج في نفس السطر */}
      {onOpenHistory && (
        <div className="shrink-0 pb-1.5">
          <button
            type="button"
            onClick={onOpenHistory}
            title="عرض سجل الفواتير السابقة وإعادة الطباعة"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>سجل الفواتير</span>
            <span className="bg-slate-900 border border-slate-700 text-sky-300 font-mono text-[10px] px-1.5 rounded-full">
              {invoicesCount}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
