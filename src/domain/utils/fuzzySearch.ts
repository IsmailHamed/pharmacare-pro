import { ProductEntity } from "../entities";

/**
 * تحويل الأرقام العربية والفارسية (٠-٩ / ۰-۹) إلى أرقام غربية قياسية (0-9)
 */
const normalizeDigits = (text: string): string =>
  text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * التطبيع الأساسي للنص العربي والإنجليزي:
 * - توحيد الهمزات والألف المقصورة والتاء المربوطة
 * - إزالة التشكيل والتطويل
 * - تحويل الأرقام العربية إلى قياسية
 */
export const normalizeSearchText = (raw: string): string => {
  if (!raw) return "";
  return normalizeDigits(raw)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // إزالة التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * التطبيع الصوتي المتسامح (Phonetic Key):
 * يوحّد النطق المتشابه في الإنجليزية والعربية لتصحيح الأخطاء الشائعة في أسماء الأدوية
 */
export const toPhoneticKey = (raw: string): string => {
  const base = normalizeSearchText(raw);
  if (!base) return "";

  return (
    base
      // توحيد التاء المربوطة/الهاء/التاء في نهاية الكلمات العربية (مثل: كبسولت <-> كبسولة)
      .replace(/([\u0621-\u064A])[ةهت](?=\s|$)/g, "$1ه")
      // توحيد الأصوات الإنجليزية المتقاربة في نطق الأدوية
      .replace(/ph/g, "f")
      .replace(/ck/g, "k")
      .replace(/c(?=[eiy])/g, "s")
      .replace(/c/g, "k")
      .replace(/q/g, "k")
      .replace(/x/g, "ks")
      .replace(/z/g, "s")
      .replace(/b/g, "p")
      .replace(/v/g, "f")
      .replace(/y/g, "i")
      .replace(/ee|ea/g, "i")
      .replace(/oo/g, "u")
      // اختزال الحروف المكررة المتتالية فقط (مع الحفاظ على الأرقام مثل 500 و 1000 كما هي)
      .replace(/([^\d\s])\1+/g, "$1")
  );
};

/**
 * تقسيم النص إلى مقاطع (Tokens) مع فصل الحدود بين الحروف والأرقام
 * مثال: "Panadol 500mg" -> ["panadol", "500mg", "500", "mg"]
 * ومثال البحث: "pan500" -> ["pan", "500"]
 */
export const tokenizeSearchText = (
  normalizedText: string,
  includeCombined = false,
): string[] => {
  if (!normalizedText) return [];

  const rawParts = normalizedText.split(/[\s\-_/]+/).filter(Boolean);
  const tokens = new Set<string>();

  for (const part of rawParts) {
    if (includeCombined) {
      tokens.add(part);
    }
    // فصل الحروف عن الأرقام (مثل 500mg -> 500 و mg، أو pan500 -> pan و 500)
    const splitParts = part
      .replace(/([\p{L}])(\d)/gu, "$1 $2")
      .replace(/(\d)([\p{L}])/gu, "$1 $2")
      .split(" ")
      .filter(Boolean);

    for (const sp of splitParts) {
      tokens.add(sp);
    }
  }

  return Array.from(tokens);
};

/**
 * حساب مسافة التعديل المحدودة (Bounded Damerau-Levenshtein)
 * تدعم تبديل حرفين متجاورين كخطأ واحد (مثل panodol / panaodl) مع توقف مبكر للسرعة القصوى
 */
const damerauLevenshteinBounded = (
  a: string,
  b: string,
  maxDist: number,
): number => {
  const lenA = a.length;
  const lenB = b.length;

  if (a === b) return 0;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;

  const prev2 = new Int32Array(lenB + 1);
  let prev = new Int32Array(lenB + 1);
  let curr = new Int32Array(lenB + 1);

  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = i;
    const chA = a.charCodeAt(i - 1);

    for (let j = 1; j <= lenB; j++) {
      const chB = b.charCodeAt(j - 1);
      const cost = chA === chB ? 0 : 1;

      let val = Math.min(
        prev[j] + 1, // حذف
        curr[j - 1] + 1, // إضافة
        prev[j - 1] + cost, // استبدال
      );

      // تبديل حرفين متجاورين (Transposition)
      if (
        i > 1 &&
        j > 1 &&
        chA === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === chB
      ) {
        val = Math.min(val, prev2[j - 2] + 1);
      }

      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return maxDist + 1;

    prev2.set(prev);
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[lenB];
};

const isNumericToken = (token: string): boolean => /^\d+(\.\d+)?$/.test(token);

export interface IndexedProduct {
  product: ProductEntity;
  barcodeLower: string;
  nameNorm: string;
  namePhonetic: string;
  scientificNorm: string;
  combinedNorm: string;
  combinedPhonetic: string;
  normTokens: string[];
  phoneticTokens: string[];
}

/**
 * بناء فهرس بحث مسبق لمرة واحدة عند تغيّر قائمة الأدوية (للحفاظ على سرعة البحث مع 10,000+ صنف)
 */
export const buildProductSearchIndex = (
  products: ProductEntity[],
): IndexedProduct[] => {
  return products.map((product) => {
    const nameNorm = normalizeSearchText(product.name);
    const scientificNorm = normalizeSearchText(product.scientificName);
    const categoryNorm = normalizeSearchText(product.category || "");
    const combinedNorm = `${nameNorm} ${scientificNorm} ${categoryNorm}`.trim();
    const combinedPhonetic = toPhoneticKey(combinedNorm);

    return {
      product,
      barcodeLower: product.barcode.toLowerCase().trim(),
      nameNorm,
      namePhonetic: toPhoneticKey(nameNorm),
      scientificNorm,
      combinedNorm,
      combinedPhonetic,
      normTokens: tokenizeSearchText(combinedNorm, true),
      phoneticTokens: tokenizeSearchText(combinedPhonetic, true),
    };
  });
};

/**
 * تقييم مدى تطابق مقطع بحث واحد مع مقاطع الدواء المفهرسة
 */
const scoreSingleToken = (
  qNorm: string,
  qPhonetic: string,
  item: IndexedProduct,
): number => {
  const numeric = isNumericToken(qNorm);

  // 1. تطابق تام مع أحد المقاطع (أعلى أولوية — مهم جداً للعيارات مثل 500 أو 1000)
  for (let i = 0; i < item.normTokens.length; i++) {
    const t = item.normTokens[i];
    if (t === qNorm) return 100;
  }

  // 2. تطابق بادئة المقطع (مثل "pan" مع "panadol" أو "50" أثناء كتابة "500")
  for (let i = 0; i < item.normTokens.length; i++) {
    const t = item.normTokens[i];
    if (t.startsWith(qNorm)) return 85;
  }

  // للأرقام والعيارات: نمنع التسامح الإملائي (Fuzzy) كإجراء أمان صيدلاني حتى لا يطابق 500 مع 600
  if (numeric) {
    return item.combinedNorm.includes(qNorm) ? 65 : 0;
  }

  // 3. تطابق صوتي تام أو بادئة صوتية (مثل "ban" مع "panadol" أو "cef" مع "sefalexin" أو "كبسولت" مع "كبسولة")
  if (qPhonetic) {
    for (let i = 0; i < item.phoneticTokens.length; i++) {
      const pt = item.phoneticTokens[i];
      if (pt === qPhonetic) return 80;
      if (pt.startsWith(qPhonetic)) return 72;
    }
  }

  // 4. تطابق جزئي داخل النص المطبّع أو الصوتي
  if (qNorm.length >= 2 && item.combinedNorm.includes(qNorm)) {
    return 55;
  }
  if (qPhonetic.length >= 2 && item.combinedPhonetic.includes(qPhonetic)) {
    return 48;
  }

  // 5. التسامح مع الأخطاء المطبعية (Fuzzy Typo Tolerance) للكلمات بطول 4 أحرف فأكثر
  if (qPhonetic.length >= 4) {
    const maxDist = qPhonetic.length >= 7 ? 2 : 1;

    for (let i = 0; i < item.phoneticTokens.length; i++) {
      const pt = item.phoneticTokens[i];
      if (pt.length < 3 || isNumericToken(pt)) continue;

      // مقارنة مع المقطع كاملاً أو مع بادئة بنفس الطول لالتقاط الأخطاء أثناء الكتابة
      const compareTarget =
        pt.length > qPhonetic.length + 1 ? pt.slice(0, qPhonetic.length) : pt;

      const dist = damerauLevenshteinBounded(qPhonetic, compareTarget, maxDist);
      if (dist <= maxDist) {
        return dist === 1 ? 40 : 28;
      }
    }
  }

  return 0;
};

/**
 * البحث الضبابي والصوتي الفائق السرعة عبر فهرس الأدوية
 * يدعم الباركود (مع لاحقة -S للشريط) والبحث المزدوج بالاسم والعيار معاً
 */
export const searchProductsFuzzy = (
  index: IndexedProduct[],
  rawQuery: string,
  limit = 60,
): ProductEntity[] => {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return index.slice(0, limit).map((i) => i.product);
  }

  const lowerRaw = trimmed.toLowerCase();
  const baseBarcode = lowerRaw.endsWith("-s")
    ? lowerRaw.slice(0, -2)
    : lowerRaw;

  const normQuery = normalizeSearchText(trimmed);
  const queryTokens = tokenizeSearchText(normQuery, false);
  const phoneticQueryTokens = queryTokens.map(toPhoneticKey);

  const scored: { product: ProductEntity; score: number }[] = [];

  for (let i = 0; i < index.length; i++) {
    const item = index[i];
    let score = 0;

    // أولوية قصوى لمطابقة الباركود (كامل أو جزئي)
    if (baseBarcode && item.barcodeLower === baseBarcode) {
      score = 1000;
    } else if (
      baseBarcode.length >= 3 &&
      item.barcodeLower.includes(baseBarcode)
    ) {
      score = item.barcodeLower.startsWith(baseBarcode) ? 850 : 700;
    }

    // مطابقة جميع مقاطع البحث (AND Logic) لدعم البحث المزدوج بالاسم والعيار مثل "pan 500"
    if (score === 0 && queryTokens.length > 0) {
      let totalTokenScore = 0;
      let allMatched = true;

      for (let t = 0; t < queryTokens.length; t++) {
        const tokenScore = scoreSingleToken(
          queryTokens[t],
          phoneticQueryTokens[t],
          item,
        );
        if (tokenScore === 0) {
          allMatched = false;
          break;
        }
        totalTokenScore += tokenScore;
      }

      if (allMatched) {
        score = totalTokenScore;
        // مكافأة إضافية إذا بدأ الاسم التجاري مباشرة بعبارة البحث
        if (item.nameNorm.startsWith(normQuery)) {
          score += 120;
        } else if (item.namePhonetic.startsWith(toPhoneticKey(normQuery))) {
          score += 75;
        }
      }
    }

    if (score > 0) {
      scored.push({ product: item.product, score });
    }
  }

  // ترتيب النتائج تنازلياً حسب الدقة ثم أبجدياً عند التساوي
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  return scored.slice(0, limit).map((s) => s.product);
};
