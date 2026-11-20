import React, { useEffect, useMemo, useState } from "react";
import { LedgerPaymentItem } from "./LedgerPartyStatement";
import { LedgerVoucherReceiptData } from "./LedgerVoucherReceiptModal";
import {
  Receipt,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Building2,
} from "lucide-react";

type VoucherTypeFilter = "ALL" | "CUSTOMER" | "SUPPLIER";

interface Props {
  ledgerPayments: LedgerPaymentItem[];
  canViewSuppliers: boolean;
  onReprintVoucher: (voucher: LedgerVoucherReceiptData) => void;
}

/**
 * سجل السندات الموحد (Audit Log)
 * يعرض جميع سندات القبض والصرف المسجلة بترتيب زمني مع البحث وإعادة الطباعة الحرارية
 */
export const LedgerVouchersLog: React.FC<Props> = ({
  ledgerPayments,
  canViewSuppliers,
  onReprintVoucher,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<VoucherTypeFilter>("ALL");

  // إغلاق آمن: إعادة الفلتر للكل إذا تم تبديل المستخدم لحساب لا يملك صلاحية عرض ذمم المستودعات
  useEffect(() => {
    if (!canViewSuppliers && typeFilter === "SUPPLIER") {
      setTypeFilter("ALL");
    }
  }, [canViewSuppliers, typeFilter]);

  // استبعاد سندات المستودعات عن غير المخولين وترتيب السندات من الأحدث للأقدم
  const accessiblePayments = useMemo(() => {
    const allowed = canViewSuppliers
      ? ledgerPayments
      : ledgerPayments.filter((p) => p.partyType === "CUSTOMER");

    return [...allowed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [ledgerPayments, canViewSuppliers]);

  const stats = useMemo(() => {
    let customerCount = 0;
    let customerTotal = 0;
    let supplierCount = 0;
    let supplierTotal = 0;

    accessiblePayments.forEach((p) => {
      if (p.partyType === "CUSTOMER") {
        customerCount += 1;
        customerTotal += p.amount;
      } else {
        supplierCount += 1;
        supplierTotal += p.amount;
      }
    });

    return {
      customerCount,
      customerTotal,
      supplierCount,
      supplierTotal,
    };
  }, [accessiblePayments]);

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessiblePayments.filter((p) => {
      if (typeFilter !== "ALL" && p.partyType !== typeFilter) return false;
      if (
        q &&
        !p.id.toLowerCase().includes(q) &&
        !p.partyName.toLowerCase().includes(q) &&
        !(p.notes || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [accessiblePayments, typeFilter, searchQuery]);

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + p.amount, 0),
    [filteredPayments],
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وبطاقات الملخص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" /> سجل سندات القبض
            والصرف الموحد (Audit Log)
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            توثيق زمني لجميع الدفعات المحصّلة من العملاء{" "}
            {canViewSuppliers ? "والمسددة للمستودعات " : ""}مع إمكانية إعادة
            طباعة أي سند حراري.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">إجمالي السندات</div>
            <div className="font-mono font-bold text-white text-sm">
              {accessiblePayments.length}
            </div>
          </div>

          <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-sky-300/80">
              سندات قبض العملاء ({stats.customerCount})
            </div>
            <div className="font-mono font-extrabold text-sky-400 text-sm">
              +{stats.customerTotal.toFixed(2)} ر.س
            </div>
          </div>

          {canViewSuppliers && (
            <div className="bg-purple-950/35 border border-purple-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-purple-300/80">
                سندات صرف المستودعات ({stats.supplierCount})
              </div>
              <div className="font-mono font-extrabold text-purple-400 text-sm">
                -{stats.supplierTotal.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* شريط البحث والفلترة حسب نوع السند */}
      {accessiblePayments.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم السند، اسم العميل أو المستودع، أو الملاحظات..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg pr-9 pl-3 py-1.5 text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {canViewSuppliers && (
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {(
                  [
                    { id: "ALL", label: "الكل" },
                    { id: "CUSTOMER", label: "قبض (عملاء)" },
                    { id: "SUPPLIER", label: "صرف (مستودعات)" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      typeFilter === tab.id
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="text-slate-400 font-mono text-[11px]">
              المعروض: <b className="text-white">{filteredPayments.length}</b> •
              المجموع:{" "}
              <b className="text-emerald-400">{filteredTotal.toFixed(2)} ر.س</b>
            </div>
          </div>
        </div>
      )}

      {/* جدول السندات أو الحالة الفارغة */}
      {accessiblePayments.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-center gap-2">
          <Receipt className="w-9 h-9 text-slate-700 stroke-1" />
          <p className="font-bold text-slate-400">
            لا توجد سندات قبض أو صرف مسجلة حتى الآن.
          </p>
          <p className="text-[11px] text-slate-500">
            عند تسجيل أي دفعة من تبويب الذمم سيُحفظ السند هنا تلقائياً مع
            إمكانية إعادة طباعته في أي وقت.
          </p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد سندات مطابقة لخيارات البحث أو الفلترة الحالية.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2.5">رقم السند</th>
                <th className="py-2 px-2.5">النوع</th>
                <th className="py-2 px-2.5">العميل / المستودع</th>
                <th className="py-2 px-2.5 text-center">المبلغ</th>
                <th className="py-2 px-2.5">التاريخ والوقت</th>
                <th className="py-2 px-2.5">الملاحظات</th>
                <th className="py-2 px-2.5 text-center">إعادة طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredPayments.map((payment) => {
                const isCustomer = payment.partyType === "CUSTOMER";
                return (
                  <tr
                    key={payment.id}
                    className="hover:bg-slate-800/40 transition"
                  >
                    <td className="py-2.5 px-2.5 font-bold text-white whitespace-nowrap">
                      {payment.id}
                    </td>

                    <td className="py-2.5 px-2.5 font-sans whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCustomer
                            ? "bg-sky-950/60 border-sky-800 text-sky-300"
                            : "bg-purple-950/60 border-purple-800 text-purple-300"
                        }`}
                      >
                        {isCustomer ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {isCustomer ? "سند قبض" : "سند صرف"}
                      </span>
                    </td>

                    <td className="py-2.5 px-2.5 font-sans">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        {isCustomer ? (
                          <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                        <span>{payment.partyName}</span>
                      </div>
                    </td>

                    <td
                      className={`py-2.5 px-2.5 text-center font-extrabold whitespace-nowrap ${
                        isCustomer ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isCustomer ? "+" : "-"}
                      {payment.amount.toFixed(2)} ر.س
                    </td>

                    <td className="py-2.5 px-2.5 text-slate-400 whitespace-nowrap">
                      {new Date(payment.createdAt).toLocaleString("ar-SA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>

                    <td className="py-2.5 px-2.5 font-sans text-slate-400 max-w-[220px] truncate">
                      {payment.notes || "—"}
                    </td>

                    <td className="py-2.5 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          onReprintVoucher({
                            id: payment.id,
                            partyType: payment.partyType,
                            partyName: payment.partyName,
                            amount: payment.amount,
                            createdAt: payment.createdAt,
                            notes: payment.notes,
                          })
                        }
                        title="إعادة طباعة السند الحراري (80mm)"
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white font-sans font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        <Printer className="w-3.5 h-3.5" /> طباعة
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
