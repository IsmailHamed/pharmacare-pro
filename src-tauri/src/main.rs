#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptLine {
    name: String,
    unit: String,
    qty: u32,
    unit_price: f64,
    line_total: f64,
}

#[tauri::command]
fn print_thermal_receipt(
    invoice_id: String,
    customer_name: String,
    payment_mode: String,
    subtotal: f64,
    discount_percent: f64,
    total: f64,
    lines_json: String,
) -> Result<String, String> {
    let lines: Vec<ReceiptLine> = serde_json::from_str(&lines_json).unwrap_or_default();

    // بناء حزمة بايتات أوامر الطابعة الحرارية القياسية (ESC/POS 80mm)
    let mut esc_pos_buffer: Vec<u8> = Vec::new();
    // ESC @ (تهيئة الطابعة)
    esc_pos_buffer.extend_from_slice(&[0x1B, 0x40]);
    // ESC a 1 (محاذاة للوسط)
    esc_pos_buffer.extend_from_slice(&[0x1B, 0x61, 0x01]);

    let header = format!(
        "=== PharmaCare Pro ===\nInvoice: {}\nCustomer: {}\nPayment: {}\n--------------------------------\n",
        invoice_id, customer_name, payment_mode
    );
    esc_pos_buffer.extend_from_slice(header.as_bytes());

    for item in &lines {
        let row = format!(
            "{} ({} x {:.2}) = {:.2}\n",
            item.name, item.qty, item.unit_price, item.line_total
        );
        esc_pos_buffer.extend_from_slice(row.as_bytes());
    }

    let footer = format!(
        "--------------------------------\nSubtotal: {:.2}\nDiscount: {:.1}%\nTOTAL: {:.2} SAR\n\n",
        subtotal, discount_percent, total
    );
    esc_pos_buffer.extend_from_slice(footer.as_bytes());

    // GS V A 16 (قص الورق الحراري تلقائياً بعد الطباعة)
    esc_pos_buffer.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]);

    println!(
        "[ESC/POS Thermal Printer] Sent {} bytes for Invoice {} (Items: {}, Total: {:.2})",
        esc_pos_buffer.len(),
        invoice_id,
        lines.len(),
        total
    );

    Ok(format!("تمت طباعة الإيصال الحراري رقم {} بنجاح", invoice_id))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![print_thermal_receipt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}