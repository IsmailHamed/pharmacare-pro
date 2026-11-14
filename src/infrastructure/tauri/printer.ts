import { InvoiceEntity } from "../../domain/entities/Invoice";
import { SettingsService } from "../config/SettingsService";
import { isTauriDesktop } from "../db/connection";

/**
 * تنسيق نص الإيصال الحراري (80mm) ليرسل مباشرة إلى طابعة الكاشير عبر نواة Rust
 */
export const formatThermalReceiptText = (invoice: InvoiceEntity): string => {
  const settings = SettingsService.getSettings();
  const divider = "----------------------------------------";
  const doubleDivider = "========================================";
  const dateStr = new Date(invoice.createdAt).toLocaleString("ar-SA");
  const discountVal = (invoice.subtotal * invoice.discountPercent) / 100;

  const lines: string[] = [doubleDivider, `      ${settings.pharmacyName}`];

  if (settings.address) {
    lines.push(`   ${settings.address}`);
  }
  if (settings.phone) {
    lines.push(`   هاتف: ${settings.phone}`);
  }
  if (settings.taxNumber) {
    lines.push(`   الرقم الضريبي: ${settings.taxNumber}`);
  }

  lines.push(
    doubleDivider,
    `رقم الفاتورة : ${invoice.id}`,
    `التاريخ      : ${dateStr}`,
    `العميل       : ${invoice.customerName || "عميل نقدي"}`,
    `النوع / الدفع: ${invoice.type === "SALE" ? "فاتورة بيع" : "مرتجع"} (${
      invoice.paymentMode === "CASH" ? "نقدي" : "آجل"
    })`,
    divider,
    "الصنف (الوحدة)            الكمية × السعر = الإجمالي",
    divider,
  );

  for (const item of invoice.items) {
    const unitLabel = item.unit === "pack" ? "علبة" : "شريط";
    const lineTotal = (item.qty * item.unitPrice).toFixed(2);
    lines.push(`${item.product.name} (${unitLabel})`);
    lines.push(
      `   ${item.qty} × ${item.unitPrice.toFixed(2)} = ${lineTotal} ر.س`,
    );
  }

  lines.push(divider, `الإجمالي الفرعي : ${invoice.subtotal.toFixed(2)} ر.س`);

  if (invoice.discountPercent > 0) {
    lines.push(
      `الخصم (${invoice.discountPercent}%)     : -${discountVal.toFixed(2)} ر.س`,
    );
  }

  lines.push(
    doubleDivider,
    `الصافي المطلوب  : ${invoice.totalAmount.toFixed(2)} ر.س`,
    doubleDivider,
    `         *${invoice.id}*`,
  );

  if (settings.receiptFooter) {
    lines.push(divider, settings.receiptFooter);
  }

  lines.push("", "", "");
  return lines.join("\n");
};

/**
 * جلب قائمة الطابعات المعرفة في نظام ويندوز عبر نواة Rust
 */
export const getSystemPrinters = async (): Promise<string[]> => {
  if (!isTauriDesktop()) {
    return ["POS-80-Series", "Microsoft Print to PDF", "XP-80C"];
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const printers = await invoke<string[]>("list_system_printers");
    return printers.length > 0 ? printers : ["POS-80-Series"];
  } catch (err) {
    console.warn("Could not list system printers:", err);
    return ["POS-80-Series"];
  }
};

/**
 * طباعة الإيصال الحراري بشكل صامت وفوري عبر Rust دون إظهار نافذة المتصفح
 */
export const printThermalReceipt = async (
  invoice: InvoiceEntity,
): Promise<boolean> => {
  const settings = SettingsService.getSettings();
  const receiptText = formatThermalReceiptText(invoice);

  if (isTauriDesktop()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke<string>("print_thermal_receipt_silent", {
        printerName: settings.thermalPrinterName,
        receiptText,
      });
      console.info(
        `🖨️ [Silent Thermal Print]: Invoice ${invoice.id} printed directly to (${settings.thermalPrinterName}).`,
      );
      return true;
    } catch (error) {
      console.warn("⚠️ [Silent Print Error]:", error);
      return false;
    }
  }

  console.info(
    `🖨️ [Browser Mode Simulated Print -> ${settings.thermalPrinterName}]:\n${receiptText}`,
  );
  return true;
};
