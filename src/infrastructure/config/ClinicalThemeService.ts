export type ClinicalThemeMode = "standard" | "clinical-night";

const CLINICAL_THEME_STORAGE_KEY = "PHARMACARE_CLINICAL_THEME_V1";
const CLINICAL_STYLE_ELEMENT_ID = "pharmacare-clinical-night-styles";

/**
 * أنماط الوضع الليلي السريري (Clinical Night Mode)
 * تُحقن ديناميكياً في <head> بدون الحاجة لملف index.css خارجي
 */
const CLINICAL_NIGHT_CSS = `
  html[data-clinical-mode="clinical-night"] {
    color-scheme: dark;
    background-color: #06090e;
  }

  html[data-clinical-mode="clinical-night"] body {
    background-color: #06090e;
    color: #dcd9ce;
  }

  /* طبقة ترشيح دافئة شديدة الخفة لتقليل الضوء الأزرق وإجهاد العين أثناء المناوبات الليلية */
  html[data-clinical-mode="clinical-night"]::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    background: rgba(255, 178, 86, 0.055);
    mix-blend-mode: screen;
  }

  /* تعميق خلفيات الواجهة لتقليل السطوع المجهد للعين */
  html[data-clinical-mode="clinical-night"] .bg-slate-950 {
    background-color: #06090e !important;
  }

  html[data-clinical-mode="clinical-night"] .bg-slate-900,
  html[data-clinical-mode="clinical-night"] .bg-slate-900\\/90,
  html[data-clinical-mode="clinical-night"] .bg-slate-900\\/60,
  html[data-clinical-mode="clinical-night"] .bg-slate-900\\/40 {
    background-color: #0c1118 !important;
  }

  html[data-clinical-mode="clinical-night"] .bg-slate-800,
  html[data-clinical-mode="clinical-night"] .bg-slate-800\\/90,
  html[data-clinical-mode="clinical-night"] .bg-slate-800\\/80 {
    background-color: #131a24 !important;
  }

  /* تهدئة حدود البطاقات والجداول */
  html[data-clinical-mode="clinical-night"] .border-slate-800,
  html[data-clinical-mode="clinical-night"] .border-slate-700 {
    border-color: #1d2633 !important;
  }

  /* تليين النص الأبيض الصارخ إلى أبيض سريري دافئ مع الحفاظ على وضوح القراءة */
  html[data-clinical-mode="clinical-night"] .text-white {
    color: #e9e5d8 !important;
  }

  html[data-clinical-mode="clinical-night"] .text-slate-100,
  html[data-clinical-mode="clinical-night"] .text-slate-200 {
    color: #d6d3c7 !important;
  }

  /* تخفيف توهج الظلال القوية في الإضاءة الليلية الخافتة */
  html[data-clinical-mode="clinical-night"] input,
  html[data-clinical-mode="clinical-night"] select,
  html[data-clinical-mode="clinical-night"] textarea {
    background-color: #090e15 !important;
    color: #e9e5d8 !important;
  }
`;

/**
 * خدمة إدارة الوضع الليلي السريري (Clinical Dark Mode)
 * تحفظ التفضيل في localStorage وتطبّق السمة فوراً دون الحاجة لإعادة تحميل التطبيق
 */
export class ClinicalThemeService {
  private static currentMode: ClinicalThemeMode =
    ClinicalThemeService.loadMode();

  private static loadMode(): ClinicalThemeMode {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(CLINICAL_THEME_STORAGE_KEY);
        if (saved === "clinical-night" || saved === "standard") {
          return saved;
        }
      }
    } catch {
      // تجاهل أخطاء التخزين والعودة للوضع الافتراضي
    }
    return "standard";
  }

  private static ensureStyleElement(): void {
    if (typeof document === "undefined") return;
    if (document.getElementById(CLINICAL_STYLE_ELEMENT_ID)) return;

    const styleEl = document.createElement("style");
    styleEl.id = CLINICAL_STYLE_ELEMENT_ID;
    styleEl.textContent = CLINICAL_NIGHT_CSS;
    document.head.appendChild(styleEl);
  }

  static getMode(): ClinicalThemeMode {
    return ClinicalThemeService.currentMode;
  }

  static isClinicalNight(): boolean {
    return ClinicalThemeService.currentMode === "clinical-night";
  }

  /**
   * تهيئة وتطبيق الوضع المحفوظ عند إقلاع التطبيق
   */
  static init(): ClinicalThemeMode {
    ClinicalThemeService.applyMode(ClinicalThemeService.currentMode);
    return ClinicalThemeService.currentMode;
  }

  static applyMode(mode: ClinicalThemeMode): ClinicalThemeMode {
    ClinicalThemeService.currentMode = mode;
    ClinicalThemeService.ensureStyleElement();

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-clinical-mode", mode);
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CLINICAL_THEME_STORAGE_KEY, mode);
      }
    } catch {
      // تجاهل أخطاء التخزين
    }

    return mode;
  }

  static toggle(): ClinicalThemeMode {
    const next: ClinicalThemeMode =
      ClinicalThemeService.currentMode === "clinical-night"
        ? "standard"
        : "clinical-night";
    return ClinicalThemeService.applyMode(next);
  }
}
