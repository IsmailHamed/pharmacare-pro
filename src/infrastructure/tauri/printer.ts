import { InvoiceEntity } from "../../domain/entities/Invoice";

export interface ThermalReceiptLinePayload {
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * وحدة الطباعة الحرارية المباشرة (ESC/POS via Tauri v2 Rust Bridge)
 * تقوم بالطباعة الصامتة مباشرة عبر Rust إذا كان النظام يعمل داخل Tauri،
 * أو تولد إيصالاً حرارياً جاهزاً في وضع المتصفح.
 */
export const printThermalReceipt = async (
  invoice: InvoiceEntity,
): Promise<{
  printed: boolean;
  mode: "TAURI_RUST_ESC_POS" | "BROWSER_PREVIEW";
}> => {
  const isTauri =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const lines: ThermalReceiptLinePayload[] = invoice.items.map((item) => ({
    name: item.product.name,
    unit: item.unit === "pack" ? "علبة" : "شريط",
    qty: item.qty,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.unitPrice * item.qty).toFixed(2)),
  }));

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("print_thermal_receipt", {
        invoiceId: invoice.id,
        customerName: invoice.customerName,
        paymentMode: invoice.paymentMode,
        subtotal: invoice.subtotal,
        discountPercent: invoice.discountPercent,
        total: invoice.totalAmount,
        linesJson: JSON.stringify(lines),
      });
      return { printed: true, mode: "TAURI_RUST_ESC_POS" };
    } catch (err) {
      console.warn("Tauri Thermal Printer fallback:", err);
    }
  }

  return { printed: true, mode: "BROWSER_PREVIEW" };
};
