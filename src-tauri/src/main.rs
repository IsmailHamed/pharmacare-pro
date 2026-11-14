// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// جلب قائمة بأسماء جميع الطابعات المثبتة في نظام ويندوز لاختيار طابعة الكاشير منها
#[tauri::command]
fn list_system_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let ps_script = "Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { $_ }";
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Failed to query system printers: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let printers: Vec<String> = stdout
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(printers)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec!["POS-80-Series".to_string()])
    }
}

/// طباعة الإيصال الحراري (80mm) بشكل صامت ومباشر على طابعة الكاشير دون فتح نافذة المتصفح
#[tauri::command]
fn print_thermal_receipt_silent(printer_name: String, receipt_text: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut temp_path = std::env::temp_dir();
        temp_path.push("pharmacare_silent_receipt.txt");

        // كتابة نص الإيصال بترميز UTF-8 مع BOM لضمان قراءة الأحرف العربية بشكل سليم 100%
        let mut content_with_bom = vec![0xEF, 0xBB, 0xBF];
        content_with_bom.extend_from_slice(receipt_text.as_bytes());

        fs::write(&temp_path, content_with_bom)
            .map_err(|e| format!("Failed to write temporary receipt file: {}", e))?;

        let file_path_str = temp_path.to_string_lossy().replace("'", "''");
        let clean_printer = printer_name.trim().replace("'", "''");

        // سكربت طباعة مباشر عبر Windows GDI+ PrintDocument يدعم العربية والخطوط المتساوية على ورق 80mm
        let ps_script = format!(
            r#"
            Add-Type -AssemblyName System.Drawing
            $filePath = '{file_path}'
            $targetPrinter = '{printer}'
            $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)

            $doc = New-Object System.Drawing.Printing.PrintDocument
            if ($targetPrinter -ne '' -and ([System.Drawing.Printing.PrinterSettings]::InstalledPrinters -contains $targetPrinter)) {{
                $doc.PrinterSettings.PrinterName = $targetPrinter
            }}

            $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

            $doc.add_PrintPage({{
                param($sender, $e)
                $fontRegular = New-Object System.Drawing.Font('Consolas', 9, [System.Drawing.FontStyle]::Bold)
                $brush = [System.Drawing.Brushes]::Black
                $format = New-Object System.Drawing.StringFormat
                $format.Alignment = [System.Drawing.StringAlignment]::Far

                $y = 6
                $rightEdge = 270
                foreach ($line in $lines) {{
                    $rect = New-Object System.Drawing.RectangleF(4, $y, $rightEdge, 18)
                    $e.Graphics.DrawString($line, $fontRegular, $brush, $rect, $format)
                    $y += 15
                }}
                $e.HasMorePages = $false
            }})

            $doc.Print()
            "#,
            file_path = file_path_str,
            printer = clean_printer
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Silent print execution failed: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("Printer spooler error: {}", err_msg));
        }

        Ok("PRINTED_SILENTLY_OK".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (printer_name, receipt_text);
        Ok("SIMULATED_PRINT_OK".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_system_printers,
            print_thermal_receipt_silent
        ])
        .run(tauri::generate_context!())
        .expect("error while running PharmaCare Pro desktop application");
}