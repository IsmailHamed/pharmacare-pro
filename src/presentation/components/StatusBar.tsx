import React, { useEffect, useState } from "react";
import { ClinicalThemeMode } from "../../infrastructure/config/ClinicalThemeService";
import { isTauriDesktop } from "../../infrastructure/db/connection";
import {
  Cloud,
  CloudOff,
  Printer,
  Barcode,
  Database,
  Moon,
  Sun,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
} from "lucide-react";

interface Props {
  isOffline: boolean;
  pendingSyncCount: number;
  onSyncNow: () => void;
  printerName: string;
  pharmacyName: string;
  clinicalMode: ClinicalThemeMode;
  onToggleClinicalMode: () => void;
  onOpenSettings: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

const formatShiftClock = (date: Date): string =>
  date.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

/**
 * شريط الحالة السفلي الدائم (System & Clinical Status Bar)
 * يوضح حالة اتصال السحابة، الطابعة، قارئ الليزر، قاعدة البيانات، الصوت، والوضع الليلي السريري
 */
export const StatusBar: React.FC<Props> = ({
  isOffline,
  pendingSyncCount,
  onSyncNow,
  printerName,
  pharmacyName,
  clinicalMode,
  onToggleClinicalMode,
  onOpenSettings,
  soundEnabled = true,
  onToggleSound,
}) => {
  const [clockText, setClockText] = useState<string>(() =>
    formatShiftClock(new Date()),
  );

  const isDesktop = isTauriDesktop();
  const isClinicalNight = clinicalMode === "clinical-night";
  const resolvedPrinter = printerName.trim();
  const isPrinterConfigured = resolvedPrinter.length > 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockText(formatShiftClock(new Date()));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="shrink-0 bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-400">
      {/* الجانب الأيمن: حالة السحابة والمزامنة + الطابعة + قارئ الليزر + SQLite */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
        {/* مؤشر السحابة والمزامنة السريعة */}
        <button
          type="button"
          onClick={onSyncNow}
          title={
            isOffline
              ? "لا يوجد اتصال بالسحابة — يتم الحفظ محلياً في SQLite"
              : "اضغط لإرسال الحركات المعلقة إلى السحابة الآن"
          }
          className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold transition ${
            isOffline
              ? "bg-amber-950/50 border-amber-800/80 text-amber-300"
              : pendingSyncCount > 0
                ? "bg-sky-950/60 hover:bg-sky-900/70 border-sky-700/80 text-sky-300"
                : "bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300"
          }`}
        >
          {isOffline ? (
            <CloudOff className="w-3.5 h-3.5" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
          <span>
            {isOffline ? "السحابة: غير متصل (محلي)" : "السحابة: متصل"}
          </span>
          {pendingSyncCount > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-slate-950/80 border border-current/30 px-1.5 rounded font-mono text-[10px]">
              <RefreshCw className="w-2.5 h-2.5" />
              {pendingSyncCount} معلق
            </span>
          )}
        </button>

        {/* مؤشر حالة الطابعة (الليزر / الحرارية) */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="اضغط لفتح إعدادات الطابعة وتعديل اسم الطابعة الافتراضية"
          className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition ${
            isPrinterConfigured
              ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200"
              : "bg-rose-950/50 hover:bg-rose-900/60 border-rose-800 text-rose-300"
          }`}
        >
          <Printer
            className={`w-3.5 h-3.5 ${
              isPrinterConfigured ? "text-emerald-400" : "text-rose-400"
            }`}
          />
          <span className="font-bold">الطابعة:</span>
          <span className="font-mono text-[10.5px] max-w-[160px] truncate">
            {isPrinterConfigured ? resolvedPrinter : "غير مضبوطة"}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPrinterConfigured ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
        </button>

        {/* مؤشر قارئ الباركود الليزري */}
        <div
          title="قارئ الباركود الليزري جاهز للالتقاط التلقائي في نقطة البيع"
          className="shrink-0 hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/70 text-slate-300"
        >
          <Barcode className="w-3.5 h-3.5 text-sky-400" />
          <span>الليزر:</span>
          <span className="font-bold text-emerald-300">جاهز</span>
        </div>

        {/* مؤشر قاعدة البيانات المحلية */}
        <div
          title={
            isDesktop
              ? "التخزين المحلي يعمل عبر SQLite الأصلي لسطح المكتب (Tauri)"
              : "وضع المتصفح — التخزين المحلي عبر محرك الذاكرة و LocalStorage"
          }
          className="shrink-0 hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/50 border border-slate-800 text-slate-400"
        >
          <Database className="w-3 h-3 text-indigo-400" />
          <span className="font-mono text-[10px]">
            {isDesktop ? "SQLite Desktop" : "Local Engine"}
          </span>
        </div>
      </div>

      {/* الجانب الأيسر: اسم الفرع + زر الصوت + زر الوضع الليلي السريري + ساعة المناوبة */}
      <div className="flex items-center gap-2 shrink-0">
        {pharmacyName.trim() && (
          <span className="hidden lg:inline text-[10.5px] text-slate-400 font-semibold max-w-[170px] truncate">
            {pharmacyName}
          </span>
        )}

        {/* زر كتم أو تفعيل النغمات الصوتية */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={
              soundEnabled
                ? "كتم النغمات الصوتية لنقطة البيع (البيع والشريط والتحذير)"
                : "تفعيل النغمات الصوتية لنقطة البيع"
            }
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-bold transition ${
              soundEnabled
                ? "bg-sky-950/70 hover:bg-sky-900/70 border-sky-800 text-sky-300"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>الصوت</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                <span>مكتوم</span>
              </>
            )}
          </button>
        )}

        {/* زر التبديل السريع للوضع الليلي السريري */}
        <button
          type="button"
          onClick={onToggleClinicalMode}
          title={
            isClinicalNight
              ? "إيقاف الوضع الليلي السريري والعودة للوضع القياسي"
              : "تفعيل الوضع الليلي السريري لتخفيف إجهاد العين والوهج أثناء المناوبة الليلية"
          }
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-bold transition ${
            isClinicalNight
              ? "bg-amber-950/70 hover:bg-amber-900/70 border-amber-600/80 text-amber-200"
              : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
          }`}
        >
          {isClinicalNight ? (
            <>
              <Moon className="w-3.5 h-3.5 text-amber-300" />
              <span>ليلي سريري</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-sky-400" />
              <span>وضع قياسي</span>
            </>
          )}
        </button>

        {/* ساعة المناوبة */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 font-mono text-[10.5px] text-slate-300">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{clockText}</span>
        </div>
      </div>
    </footer>
  );
};
