// الخيارات السريعة المدعومة لنطاق التواريخ في جداول السجلات والحركات
export type DateRangePreset =
  | "ALL"
  | "TODAY"
  | "LAST_7_DAYS"
  | "THIS_MONTH"
  | "CUSTOM";

// الحالة الموحّدة لفلتر التاريخ القابلة للتمرير بين المكونات
export interface DateRangeValue {
  preset: DateRangePreset;
  // تاريخ البداية بصيغة YYYY-MM-DD (فارغ يعني بدون حد أدنى)
  from: string;
  // تاريخ النهاية بصيغة YYYY-MM-DD (فارغ يعني بدون حد أقصى)
  to: string;
}

// القيمة الابتدائية الافتراضية (عرض كافة التواريخ بدون تصفية)
export const DEFAULT_DATE_RANGE: DateRangeValue = {
  preset: "ALL",
  from: "",
  to: "",
};

/**
 * تحويل كائن Date إلى نص محلي بصيغة YYYY-MM-DD
 * نعتمد على مكونات التاريخ المحلي بدلاً من toISOString() لمنع انزياح اليوم
 * أثناء المناوبات الليلية بسبب فرق التوقيت عن UTC
 */
export const formatLocalDateYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * استخراج تاريخ اليوم المحلي (YYYY-MM-DD) من قيمة نصية سواء كانت تاريخاً فقط
 * (مثل 2026-11-22) أو طابعاً زمنياً كاملاً بصيغة ISO
 */
export const extractComparableDateYmd = (rawDate: string): string => {
  const trimmed = rawDate.trim();
  if (!trimmed) return "";

  // إذا كانت القيمة تاريخاً صافياً YYYY-MM-DD نستخدمها مباشرة دون تحويل زمني
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDateYmd(parsed);
  }

  // مسار احتياطي آمن في حال كانت الصيغة غير قياسية
  return trimmed.slice(0, 10);
};

/**
 * بناء كائن DateRangeValue تلقائياً عند اختيار أحد الأزرار السريعة
 */
export const buildDateRangeFromPreset = (
  preset: Exclude<DateRangePreset, "CUSTOM">,
  referenceDate: Date = new Date(),
): DateRangeValue => {
  if (preset === "ALL") {
    return { preset: "ALL", from: "", to: "" };
  }

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const todayStr = formatLocalDateYmd(today);

  if (preset === "TODAY") {
    return { preset: "TODAY", from: todayStr, to: todayStr };
  }

  if (preset === "LAST_7_DAYS") {
    // يشمل اليوم الحالي بالإضافة إلى الأيام الستة السابقة (المجموع 7 أيام)
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return {
      preset: "LAST_7_DAYS",
      from: formatLocalDateYmd(start),
      to: todayStr,
    };
  }

  // خيار THIS_MONTH: من أول يوم في الشهر الحالي حتى اليوم الحالي
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    preset: "THIS_MONTH",
    from: formatLocalDateYmd(monthStart),
    to: todayStr,
  };
};

/**
 * التحقق مما إذا كان فلتر التاريخ مفعّلاً حالياً (لإظهار زر إعادة ضبط الفلاتر)
 */
export const isDateRangeActive = (range: DateRangeValue): boolean =>
  Boolean(range.from || range.to);

/**
 * فحص مطابقة تاريخ سجل معيّن لنطاق التواريخ المحدد
 */
export const matchesDateRange = (
  rawDate: string | null | undefined,
  range: DateRangeValue,
): boolean => {
  if (!range.from && !range.to) return true;
  if (!rawDate) return false;

  const dateYmd = extractComparableDateYmd(rawDate);
  if (!dateYmd) return false;

  if (range.from && dateYmd < range.from) return false;
  if (range.to && dateYmd > range.to) return false;

  return true;
};
