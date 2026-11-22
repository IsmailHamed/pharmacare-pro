import React from "react";
import { parseLasaDisplay } from "../../../domain/utils/lasaFormatter";
import { AlertTriangle } from "lucide-react";

interface Props {
  name: string;
  category?: string;
  isControlled?: boolean;
  isLasaRisk?: boolean;
  isTopMatch?: boolean;
  size?: "sm" | "md";
}

/**
 * مكوّن عرض موحّد لهوية الدواء وشارات التمييز البصري (LASA):
 * الاسم الأساسي + شارات العيارات الملونة + الصفات الفارقة + الشكل الصيدلاني + تنبيهات الأمان
 */
export const DrugIdentityBadges: React.FC<Props> = ({
  name,
  category,
  isControlled = false,
  isLasaRisk = false,
  isTopMatch = false,
  size = "md",
}) => {
  const lasa = parseLasaDisplay(name, category);
  const isMd = size === "md";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`font-bold text-white tracking-tight ${
          isMd ? "text-[13px]" : "text-xs"
        }`}
      >
        {lasa.baseName}
      </span>

      {lasa.strengths.map((strength) => (
        <span
          key={strength.text}
          dir="ltr"
          className={`inline-flex items-center rounded-md border font-black font-mono ${
            isMd
              ? "px-2 py-0.5 text-[12px] tracking-wide"
              : "px-1.5 py-0.5 text-[10.5px]"
          } ${strength.badgeClass}`}
        >
          {strength.text}
        </span>
      ))}

      {lasa.modifiers.map((mod) => (
        <span
          key={mod}
          className={`inline-flex items-center rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 font-extrabold ${
            isMd ? "px-1.5 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          {mod}
        </span>
      ))}

      {lasa.dosageForm && (
        <span
          className={`inline-flex items-center rounded-md border ${
            isMd ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]"
          } ${lasa.dosageForm.badgeClass}`}
        >
          {lasa.dosageForm.label}
        </span>
      )}

      {isControlled && (
        <span
          className={`bg-rose-950 text-rose-300 border border-rose-800 rounded font-bold ${
            isMd ? "text-[10px] px-1.5 py-0.5" : "text-[9.5px] px-1.5 py-0.5"
          }`}
        >
          مراقب 🔒
        </span>
      )}

      {isLasaRisk && (
        <span
          title="يوجد أكثر من عيار أو شكل صيدلاني لهذا الاسم في القائمة — تحقق من العيار قبل الصرف"
          className="inline-flex items-center gap-0.5 bg-amber-950/90 border border-amber-600/70 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          LASA
        </span>
      )}

      {isTopMatch && (
        <span className="bg-sky-950 text-sky-300 border border-sky-700/80 text-[9px] font-mono px-1.5 py-0.5 rounded">
          ↵ Enter
        </span>
      )}
    </div>
  );
};
