export interface WhatsAppOrderLineInput {
  name: string;
  scientificName: string;
  qty: number;
  unitLabel?: string;
  supplierName?: string | null;
}

export interface WhatsAppOrderMessageOptions {
  pharmacyName: string;
  pharmacyPhone: string;
  dateLabel?: string;
  supplier?: {
    name: string;
    salesRepName?: string;
  } | null;
  items: WhatsAppOrderLineInput[];
  unassignedGroupLabel?: string;
}

/**
 * تنظيف رقم الهاتف وإزالة الرموز والبادئة الدولية 00 لتجهيزه لرابط واتساب (wa.me)
 */
export const sanitizeWhatsAppPhone = (phone?: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^00/, "");
};

/**
 * بناء نص طلبية النواقص لواتساب (إما موجّه لمستودع محدد أو مجمّع حسب المستودعات)
 */
export const buildWhatsAppOrderText = (
  options: WhatsAppOrderMessageOptions,
): string => {
  const {
    pharmacyName,
    pharmacyPhone,
    dateLabel = new Date().toLocaleDateString("ar-SA"),
    supplier,
    items,
    unassignedGroupLabel = "أصناف غير موزعة على مستودع",
  } = options;

  if (supplier) {
    const lines = items.map((item, idx) => {
      const unit = item.unitLabel || "علبة";
      return `${idx + 1}. ${item.name} (${item.scientificName}) — المطلوب: [${item.qty} ${unit}]`;
    });

    return [
      `📋 *طلبية نواقص أدوية - ${pharmacyName}*`,
      `التاريخ: ${dateLabel}`,
      `إلى السادة: *${supplier.name}*${
        supplier.salesRepName ? ` (المندوب: ${supplier.salesRepName})` : ""
      }`,
      `--------------------------------`,
      ...lines,
      `--------------------------------`,
      `إجمالي الأصناف المطلوبة: ${lines.length} صنف`,
      `هاتف الصيدلية: ${pharmacyPhone}`,
    ].join("\n");
  }

  const grouped = new Map<string, WhatsAppOrderLineInput[]>();
  items.forEach((item) => {
    const groupName = item.supplierName?.trim() || unassignedGroupLabel;
    const list = grouped.get(groupName) || [];
    list.push(item);
    grouped.set(groupName, list);
  });

  const blocks: string[] = [];
  grouped.forEach((groupItems, groupName) => {
    const lines = groupItems.map((item, idx) => {
      const unit = item.unitLabel || "علبة";
      return `  ${idx + 1}. ${item.name} (${item.scientificName}) — [${item.qty} ${unit}]`;
    });
    blocks.push(
      `📦 *${groupName}* (${groupItems.length} صنف):\n${lines.join("\n")}`,
    );
  });

  return [
    `📋 *طلبيات نواقص أدوية - ${pharmacyName}*`,
    `التاريخ: ${dateLabel}`,
    `--------------------------------`,
    ...blocks,
    `--------------------------------`,
    `إجمالي الأصناف المطلوبة: ${items.length} صنف`,
    `هاتف الصيدلية: ${pharmacyPhone}`,
  ].join("\n");
};

/**
 * بناء رابط الإرسال المباشر عبر واتساب، ويعيد null إذا كان الرقم غير متوفر
 */
export const buildWhatsAppUrl = (
  phone: string | undefined,
  message: string,
): string | null => {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};
