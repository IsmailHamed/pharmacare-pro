import { ProductEntity } from "../entities";

export type DosageFormKey =
  | "TABLET"
  | "CAPSULE"
  | "SYRUP"
  | "INJECTION"
  | "DROPS"
  | "CREAM"
  | "SPRAY"
  | "SUPPOSITORY"
  | "SACHET";

export interface DosageFormBadge {
  key: DosageFormKey;
  label: string;
  badgeClass: string;
}

export interface StrengthBadge {
  text: string;
  badgeClass: string;
}

export interface LasaDisplayInfo {
  /** الاسم التجاري بعد فصل العيارات البارزة عنه لعرضها كشارات ضخمة واضحة */
  baseName: string;
  /** العيارات المستخرجة (مثل 500mg أو 1g أو 250mg/5ml) مع لون مميز لكل عيار */
  strengths: StrengthBadge[];
  /** الصفات الفارقة الحرجة (مثل XR, SR, Forte, Extra, أطفال) */
  modifiers: string[];
  /** الشكل الصيدلاني المكتشف مع لونه الدلالي */
  dosageForm: DosageFormBadge | null;
  /** مفتاح تجميع موحد لاكتشاف وجود أكثر من عيار/شكل لنفس الاسم التجاري (LASA) */
  lasaGroupKey: string;
}

const normalizeDigits = (text: string): string =>
  text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * لوحة ألوان عالية التباين للعيارات الدوائية (مناسبة للوضع الداكن السريري)
 * تضمن اختلاف اللون البصري بين العيارات المتجاورة لنفس الدواء
 */
const STRENGTH_PALETTE: string[] = [
  "bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.18)]",
  "bg-cyan-500/20 text-cyan-200 border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.18)]",
  "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/80 shadow-[0_0_8px_rgba(217,70,239,0.18)]",
  "bg-lime-500/20 text-lime-200 border-lime-400/80 shadow-[0_0_8px_rgba(132,204,22,0.18)]",
  "bg-orange-500/20 text-orange-200 border-orange-400/80 shadow-[0_0_8px_rgba(249,115,22,0.18)]",
  "bg-rose-500/20 text-rose-200 border-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.18)]",
];

/**
 * تعيين لون ثابت (Deterministic) بناءً على قيمة العيار المطبّعة
 * بحيث يأخذ 500mg لوناً مختلفاً دائماً عن 1000mg أو 1g أو 250mg
 */
const getStrengthColorClass = (strengthText: string): string => {
  const key = strengthText.toLowerCase().replace(/\s+/g, "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return STRENGTH_PALETTE[hash % STRENGTH_PALETTE.length];
};

/**
 * قواعد كشف الأشكال الصيدلانية (مرتّبة من الأكثر خصوصية إلى الأكثر شيوعاً)
 */
const DOSAGE_FORM_RULES: {
  key: DosageFormKey;
  label: string;
  badgeClass: string;
  pattern: RegExp;
}[] = [
  {
    key: "INJECTION",
    label: "حقن",
    badgeClass:
      "bg-rose-950/90 text-rose-200 border-rose-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(inj(?:ection)?|amp(?:oule)?s?|vials?|iv|im|حقن(?:ة|ه)?|أمبول|امبول|فيال|إبرة|ابرة)(?=$|[\s\-/)])/i,
  },
  {
    key: "SYRUP",
    label: "شراب",
    badgeClass: "bg-sky-950/90 text-sky-200 border-sky-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(syrup|syr|susp(?:ension)?|elixir|oral\s+sol(?:ution)?|شراب|معلق|معلّق)(?=$|[\s\-/)])/i,
  },
  {
    key: "DROPS",
    label: "قطرة",
    badgeClass:
      "bg-teal-950/90 text-teal-200 border-teal-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(drops?|eye\s+drops?|ear\s+drops?|nasal\s+drops?|قطر(?:ة|ه|ات)|نقط)(?=$|[\s\-/)])/i,
  },
  {
    key: "SPRAY",
    label: "بخاخ",
    badgeClass:
      "bg-indigo-950/90 text-indigo-200 border-indigo-400/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(spray|inhaler|puffer|neb(?:ule)?s?|بخاخ|رذاذ|استنشاق)(?=$|[\s\-/)])/i,
  },
  {
    key: "CREAM",
    label: "كريم/مرهم",
    badgeClass:
      "bg-purple-950/90 text-purple-200 border-purple-400/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(cream|oint(?:ment)?|gel|lotion|كريم|مرهم|جل|لوشن|دهان)(?=$|[\s\-/)])/i,
  },
  {
    key: "SUPPOSITORY",
    label: "لبوس",
    badgeClass:
      "bg-orange-950/90 text-orange-200 border-orange-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(supp(?:ositor(?:y|ies))?|لبوس|تحاميل|تحميلة|تحميله)(?=$|[\s\-/)])/i,
  },
  {
    key: "SACHET",
    label: "فوار/أكياس",
    badgeClass:
      "bg-yellow-950/90 text-yellow-200 border-yellow-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(sachets?|eff(?:ervescent)?|powder|أكياس|اكياس|كيس|فوار|فوّار|بودرة|بودره)(?=$|[\s\-/)])/i,
  },
  {
    key: "CAPSULE",
    label: "كبسول",
    badgeClass:
      "bg-violet-950/90 text-violet-200 border-violet-400/80 font-extrabold",
    pattern: /(?:^|[\s\-/(])(caps?(?:ules?)?|كبسول(?:ة|ه|ات)?)(?=$|[\s\-/)])/i,
  },
  {
    key: "TABLET",
    label: "أقراص",
    badgeClass:
      "bg-emerald-950/90 text-emerald-200 border-emerald-500/80 font-extrabold",
    pattern:
      /(?:^|[\s\-/(])(tabs?(?:lets?)?|caplets?|أقراص|اقراص|قرص|حبوب|حبة|حبه)(?=$|[\s\-/)])/i,
  },
];

/**
 * تعبير قياسي لاستخراج العيارات الدوائية المفردة والمركّبة
 * أمثلة: 500mg | 1g | 250mg/5ml | 500/125mg | 0.5% | 1000IU | 500 مجم
 */
const STRENGTH_REGEX =
  /\b\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|g|gm|mcg|µg|ug|ml|l|iu|%|مجم|ملجم|جم|غ|مل)?)?\s*(?:mg|g|gm|mcg|µg|ug|ml|iu|%|مجم|ملجم|جم|غ|ميكروجرام|مل|وحدة)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:ml|g|mg|مل|جم))?(?=$|[\s\-/),])/gi;

/**
 * تعبير قياسي لاستخراج الصفات الفارقة الحرجة بين الأدوية المتشابهة
 */
const MODIFIER_REGEX =
  /(?:^|[\s\-/(])(XR|SR|ER|CR|MR|DR|LA|Retard|Forte|Extra|Plus|Duo|Max|Advance|Junior|Pediatric|Kids|Cold\s*&\s*Flu|أطفال|اطفال|كبار|إكسترا|اكسترا|بلس|فورت|ممتد(?:\s+المفعول)?)(?=$|[\s\-/)])/gi;

/**
 * تحليل اسم الدواء وتصنيفه لاستخراج عناصر التمييز البصري (LASA)
 */
export const parseLasaDisplay = (
  name: string,
  category?: string,
): LasaDisplayInfo => {
  const normalizedName = normalizeDigits(name || "").trim();
  const normalizedCategory = normalizeDigits(category || "").trim();

  // 1. استخراج العيارات الدوائية
  const seenStrengths = new Set<string>();
  const strengths: StrengthBadge[] = [];

  const strengthMatches = normalizedName.match(STRENGTH_REGEX) || [];
  for (const rawMatch of strengthMatches) {
    const cleaned = rawMatch.trim().replace(/\s+/g, "");
    const lowerKey = cleaned.toLowerCase();
    if (!seenStrengths.has(lowerKey)) {
      seenStrengths.add(lowerKey);
      strengths.push({
        text: cleaned,
        badgeClass: getStrengthColorClass(cleaned),
      });
    }
  }

  // 2. استخراج الصفات الفارقة الحرجة (XR / Forte / Extra / أطفال...)
  const seenModifiers = new Set<string>();
  const modifiers: string[] = [];
  let modMatch: RegExpExecArray | null;
  MODIFIER_REGEX.lastIndex = 0;
  while ((modMatch = MODIFIER_REGEX.exec(normalizedName)) !== null) {
    const token = modMatch[1].trim();
    const key = token.toLowerCase();
    if (!seenModifiers.has(key)) {
      seenModifiers.add(key);
      modifiers.push(token);
    }
  }

  // 3. كشف الشكل الصيدلاني (من الاسم أولاً ثم من التصنيف إن لم يُذكر في الاسم)
  let dosageForm: DosageFormBadge | null = null;
  for (const rule of DOSAGE_FORM_RULES) {
    if (
      rule.pattern.test(normalizedName) ||
      (normalizedCategory && rule.pattern.test(normalizedCategory))
    ) {
      dosageForm = {
        key: rule.key,
        label: rule.label,
        badgeClass: rule.badgeClass,
      };
      break;
    }
  }

  // 4. تنظيف الاسم الأساسي من العيار المستخرج حتى لا يتكرر بصرياً بجانب الشارة الضخمة
  let baseName = normalizedName;
  if (strengths.length > 0) {
    baseName = baseName
      .replace(STRENGTH_REGEX, " ")
      .replace(/\(\s*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!baseName) {
    baseName = normalizedName;
  }

  // 5. بناء مفتاح المجموعة لاكتشاف تشابه الأسماء (LASA) مع تجاهل العيار والرقم التسلسلي (#1)
  const lasaGroupKey = baseName
    .replace(/#\d+/g, "")
    .replace(MODIFIER_REGEX, " ")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^a-z\u0621-\u064A]+/g, " ")
    .trim();

  return {
    baseName,
    strengths,
    modifiers,
    dosageForm,
    lasaGroupKey,
  };
};

/**
 * اكتشاف مجموعات الأدوية المتشابهة اسماً (LASA) ضمن القائمة المعروضة حالياً
 * يُعيد Set تحتوي على مفاتيح المجموعات التي يتكرر فيها نفس الاسم الأساسي بأكثر من صنف/عيار
 */
export const buildLasaRiskGroupSet = (
  products: ProductEntity[],
): Set<string> => {
  const counts = new Map<string, number>();

  for (let i = 0; i < products.length; i++) {
    const info = parseLasaDisplay(products[i].name, products[i].category);
    if (info.lasaGroupKey.length >= 3) {
      counts.set(info.lasaGroupKey, (counts.get(info.lasaGroupKey) || 0) + 1);
    }
  }

  const riskGroups = new Set<string>();
  counts.forEach((count, key) => {
    if (count > 1) {
      riskGroups.add(key);
    }
  });

  return riskGroups;
};
