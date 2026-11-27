import React, { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * أيقونة ونافذة تلميح اختصارات لوحة المفاتيح «صفر ماوس» داخل لوحة الدفع
 */
export const CartShortcutsHintPopover: React.FC<Props> = ({
  isOpen,
  isExpanded,
  onToggle,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        title="اختصارات لوحة المفاتيح السريعة (+ / - / Tab / Del / F8)"
        className={`p-1.5 rounded-lg border transition ${
          isOpen
            ? "bg-sky-950 border-sky-600 text-sky-300"
            : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400"
        }`}
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {/* توجيه نافذة تلميح الاختصارات للأسفل في الوضع الموسّع على الشاشات العريضة لتفادي قصّها من الأعلى */}
      {isOpen && (
        <div
          className={`absolute left-0 z-30 w-60 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-1.5 text-[11px] ${
            isExpanded
              ? "bottom-full mb-2 lg:bottom-auto lg:mb-0 lg:top-full lg:mt-2"
              : "bottom-full mb-2"
          }`}
        >
          <div className="font-bold text-sky-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span>اختصارات «صفر ماوس»</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>زيادة / إنقاص كمية آخر صنف</span>
            <span className="font-mono text-sky-300">+ / -</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>تبديل علبة / شريط فرط</span>
            <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
              Tab
            </kbd>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>حذف آخر صنف مضاف</span>
            <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
              Del
            </kbd>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>حاسبة الباقي العائمة</span>
            <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
              F8
            </kbd>
          </div>
          <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800 text-[10px] font-mono">
            <span>F1 بيع</span>
            <span>F4 بدائل</span>
            <span>F5 تعليق</span>
            <span>F6 مرتجع</span>
          </div>
        </div>
      )}
    </div>
  );
};
