import { PharmacySettingsEntity } from "../../domain/entities";
import { isTauriDesktop, sqliteRaw } from "../db/connection";

const SETTINGS_STORAGE_KEY = "pharmacare_pro_settings_v1";

export const DEFAULT_PHARMACY_SETTINGS: PharmacySettingsEntity = {
  pharmacyName: "صيدلية فارماكير برو",
  phone: "011-0000000",
  address: "الشارع العام - المركز الطبي",
  taxNumber: "300000000000003",
  receiptFooter: "نتمنى لكم دوام الصحة والعافية - الأدوية المبردة لا تُستبدل",
  thermalPrinterName: "POS-80-Series",
  cloudSyncUrl: "http://localhost:4000",
  scannerMaxIntervalMs: 45,
};

export class SettingsService {
  static getSettings(): PharmacySettingsEntity {
    if (typeof window === "undefined") {
      return DEFAULT_PHARMACY_SETTINGS;
    }
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_PHARMACY_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<PharmacySettingsEntity>;
      return {
        ...DEFAULT_PHARMACY_SETTINGS,
        ...parsed,
      };
    } catch {
      return DEFAULT_PHARMACY_SETTINGS;
    }
  }

  /**
   * استرجاع الإعدادات من ملف SQLite الفعلي (pharmacare.db) عند إقلاع سطح المكتب
   */
  static async syncFromSQLite(): Promise<PharmacySettingsEntity> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT payload FROM pharmacy_settings WHERE id = 'MAIN_SETTINGS' LIMIT 1;",
        );
        if (rows.length > 0 && rows[0].payload) {
          const parsed = JSON.parse(
            String(rows[0].payload),
          ) as Partial<PharmacySettingsEntity>;
          const merged = { ...DEFAULT_PHARMACY_SETTINGS, ...parsed };
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              SETTINGS_STORAGE_KEY,
              JSON.stringify(merged),
            );
          }
          return merged;
        }
      } catch {
        // fallback to localStorage
      }
    }
    return this.getSettings();
  }

  static saveSettings(
    settings: PharmacySettingsEntity,
  ): PharmacySettingsEntity {
    const clean: PharmacySettingsEntity = {
      pharmacyName:
        settings.pharmacyName.trim() || DEFAULT_PHARMACY_SETTINGS.pharmacyName,
      phone: settings.phone.trim(),
      address: settings.address.trim(),
      taxNumber: settings.taxNumber.trim(),
      receiptFooter: settings.receiptFooter.trim(),
      thermalPrinterName: settings.thermalPrinterName.trim() || "POS-80-Series",
      cloudSyncUrl:
        settings.cloudSyncUrl.trim().replace(/\/+$/, "") ||
        "http://localhost:4000",
      scannerMaxIntervalMs: Math.max(
        20,
        Math.min(120, Number(settings.scannerMaxIntervalMs) || 45),
      ),
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    }

    // حفظ نسخة دائمة داخل ملف pharmacare.db في ويندوز
    if (isTauriDesktop() && sqliteRaw) {
      void sqliteRaw.execute(
        `INSERT OR REPLACE INTO pharmacy_settings (id, payload, updated_at) VALUES ('MAIN_SETTINGS', $1, $2);`,
        [JSON.stringify(clean), new Date().toISOString()],
      );
    }

    return clean;
  }
}
