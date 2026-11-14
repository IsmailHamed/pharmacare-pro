import {
  CartItemEntity,
  DrugInteractionAlert,
  ProductEntity,
} from "../../domain/entities";
interface InteractionRule {
  id: string;
  keywordA: string;
  keywordB: string;
  severity: "HIGH" | "MODERATE";
  description: string;
  recommendation: string;
}

const CLINICAL_INTERACTION_RULES: InteractionRule[] = [
  {
    id: "INT-WARFARIN-ASPIRIN",
    keywordA: "warfarin",
    keywordB: "acetylsalicylic",
    severity: "HIGH",
    description:
      "خطر نزيف حاد ومهدد للحياة! الجمع بين الوارفارين والأسبرين يضاعف تميع الدم ويثبط الصفائح الدموية.",
    recommendation:
      "يمنع الصرف المشترك إلا بتأكيد مباشر من الطبيب المعالج ومتابعة دقيقة لمؤشر السيولة (INR).",
  },
  {
    id: "INT-WARFARIN-NSAID",
    keywordA: "warfarin",
    keywordB: "ibuprofen",
    severity: "HIGH",
    description:
      "تداخل دوائي خطير: مضادات الالتهاب غير الستيرويدية (Ibuprofen) تزيد بشكل كبير من خطر النزيف المعدي المعوي مع الوارفارين.",
    recommendation:
      "يُنصح باستبدال المسكن بالباراسيتامول (Paracetamol) بعد مراجعة الطبيب.",
  },
  {
    id: "INT-VIAGRA-NITRATES",
    keywordA: "sildenafil",
    keywordB: "isosorbide",
    severity: "HIGH",
    description:
      "مضاد استطباب قطعي! الجمع بين السيلدينافيل (فياجرا) وموسعات الشرايين التاجية (النيترات) يسبب هبوطاً حاداً وقاتلاً في ضغط الدم.",
    recommendation:
      "إيقاف صرف أحد الصنفين فوراً وتنبيه المريض لعدم استخدامهما خلال 24-48 ساعة.",
  },
  {
    id: "INT-CNS-DEPRESSANTS-1",
    keywordA: "pregabalin",
    keywordB: "alprazolam",
    severity: "HIGH",
    description:
      "تثبيط مضاعف للجهاز العصبي المركزي والتنفس عند الجمع بين البريجابالين (ليريكا) والألبرازولام (زاناكس).",
    recommendation:
      "التحقق من الوصفة الطبية وتنبيه المريض من النعاس الشديد وتثبيط التنفس.",
  },
  {
    id: "INT-CNS-TRAMADOL-XANAX",
    keywordA: "tramadol",
    keywordB: "alprazolam",
    severity: "HIGH",
    description:
      "تحذير الصندوق الأسود (Black Box Warning): الجمع بين الأفيونات (ترامادول) والبنزوديازيبينات (زاناكس) قد يؤدي إلى تثبيط تنفسي حاد أو غيبوبة.",
    recommendation:
      "مراجعة الطبيب المختص فوراً قبل الصرف وتوثيق الجرعات بدقة.",
  },
  {
    id: "INT-CNS-TRAMADOL-LYRICA",
    keywordA: "tramadol",
    keywordB: "pregabalin",
    severity: "MODERATE",
    description:
      "زيادة ملحوظة في الدوار والنعاس واضطراب التركيز الحركي عند الجمع بين الترامادول والبريجابالين.",
    recommendation:
      "تنبيه المريض لعدم قيادة المركبات والالتزام بالجرعة المسائية الموصوفة.",
  },
  {
    id: "INT-ASPIRIN-IBUPROFEN",
    keywordA: "acetylsalicylic",
    keywordB: "ibuprofen",
    severity: "MODERATE",
    description:
      "الإيبوبروفين يقلل من الفعالية القلبية الوقائية للأسبرين ويزيد من خطر قرحة المعدة.",
    recommendation:
      "المباعدة بين الجرعتين بساعتين على الأقل أو استخدام بديل آمن للمعدة.",
  },
  {
    id: "INT-DUPLICATE-PARACETAMOL",
    keywordA: "paracetamol",
    keywordB: "paracetamol",
    severity: "MODERATE",
    description:
      "تكرار المادة الفعالة (Paracetamol) في أكثر من دواء داخل السلة قد يؤدي لتجاوز الجرعة القصوى اليومية (4 جرام) وسمية الكبد.",
    recommendation:
      "تنبيه المريض لعدم تناول الصنفين معاً في نفس الوقت.",
  },
];

/**
 * محرك كشف التداخلات الدوائية الفوري والبدائل العلمية (Clinical Decision Support Engine)
 */
export class ClinicalDecisionUseCase {
  /**
   * فحص السلة وإرجاع قائمة التنبيهات الطبية للتداخلات الدوائية
   */
  public static detectDrugInteractions(
    cart: CartItemEntity[],
  ): DrugInteractionAlert[] {
    const alerts: DrugInteractionAlert[] = [];
    // استخراج قائمة الأدوية الفريدة في السلة
    const uniqueProductsMap = new Map<string, ProductEntity>();
    for (const item of cart) {
      uniqueProductsMap.set(item.product.id, item.product);
    }
    const products = Array.from(uniqueProductsMap.values());

    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const drugA = products[i];
        const drugB = products[j];
        const sciA = drugA.scientificName.toLowerCase();
        const sciB = drugB.scientificName.toLowerCase();

        for (const rule of CLINICAL_INTERACTION_RULES) {
          const matchForward =
            sciA.includes(rule.keywordA) && sciB.includes(rule.keywordB);
          const matchReverse =
            sciA.includes(rule.keywordB) && sciB.includes(rule.keywordA);

          if (matchForward || matchReverse) {
            alerts.push({
              id: `${rule.id}-${drugA.id}-${drugB.id}`,
              drugAName: drugA.name,
              drugBName: drugB.name,
              scientificA: drugA.scientificName,
              scientificB: drugB.scientificName,
              severity: rule.severity,
              description: rule.description,
              recommendation: rule.recommendation,
            });
          }
        }
      }
    }

    return alerts;
  }

  /**
   * البحث عن البدائل المطابقة في المادة الفعالة (F4 Alternatives)
   */
  public static findAlternatives(
    targetProduct: ProductEntity,
    allProducts: ProductEntity[],
  ): ProductEntity[] {
    const targetSci = targetProduct.scientificName.trim().toLowerCase();
    return allProducts.filter(
      (p) =>
        p.id !== targetProduct.id &&
        p.scientificName.trim().toLowerCase() === targetSci,
    );
  }
}
