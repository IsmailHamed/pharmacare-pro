import { SyncQueueItemEntity } from "../../domain/entities";
import { CURRENT_BRANCH_ID } from "../db/database";
import { SettingsService } from "../config/SettingsService";

export interface SystemRuntimeInfo {
  runtime: "TAURI_V2_DESKTOP" | "OFFLINE_WEB_RUNTIME";
  sqliteJournalMode: "WAL";
  branchId: string;
  isOnline: boolean;
}

export const getSystemRuntimeInfo = (): SystemRuntimeInfo => {
  const isTauri =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as Record<string, unknown>).__TAURI__ ||
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__,
    );

  return {
    runtime: isTauri ? "TAURI_V2_DESKTOP" : "OFFLINE_WEB_RUNTIME",
    sqliteJournalMode: "WAL",
    branchId: CURRENT_BRANCH_ID,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  };
};

/**
 * إرسال حزمة العمليات المتراكمة (Batch Syncing) إلى السيرفر المركزي (PostgreSQL + Node.js)
 * لا تُعاد المعرّفات كمُزامَنة (syncedIds) إلا بعد استلام تأكيد صريح (success: true) من الخادم
 */
export const pushBatchToCloudServer = async (
  pendingItems: SyncQueueItemEntity[],
  endpointUrl?: string,
): Promise<{
  success: boolean;
  syncedCount: number;
  batchId: string;
  syncedIds: string[];
  timestamp: string;
  error?: string;
}> => {
  const batchId = `BATCH-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // في حال عدم وجود حركات معلقة، نُعيد نجاحاً فورياً دون إجراء اتصال شبكي
  if (pendingItems.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      batchId,
      syncedIds: [],
      timestamp,
    };
  }

  const { cloudSyncUrl } = SettingsService.getSettings();
  const targetEndpoint = endpointUrl || `${cloudSyncUrl}/api/v1/sync/batch`;

  // استخدام AbortController لضبط مهلة انتظار الاتصال (8 ثوانٍ للدفعات الكبيرة)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId,
        branchId: CURRENT_BRANCH_ID,
        sentAt: timestamp,
        records: pendingItems,
      }),
      signal: controller.signal,
    });

    // قراءة جسم الاستجابة بأمان حتى لو أعاد الخادم نصاً غير JSON عند حدوث عطل
    const responseData = (await response.json().catch(() => null)) as {
      success?: boolean;
      syncedIds?: string[];
      syncedCount?: number;
      error?: string;
    } | null;

    // التحقق الصارم من نجاح الطلب ومن تأكيد السيرفر لحفظ المعاملة في PostgreSQL
    if (!response.ok || !responseData?.success) {
      return {
        success: false,
        syncedCount: 0,
        batchId,
        syncedIds: [],
        timestamp,
        error:
          responseData?.error ||
          `رفض الخادم حزمة المزامنة (HTTP ${response.status})`,
      };
    }

    // اعتماد قائمة المعرّفات المؤكدة من الخادم (أو جميع عناصر الدفعة بعد نجاح المعاملة)
    const confirmedIds = Array.isArray(responseData.syncedIds)
      ? responseData.syncedIds
      : pendingItems.map((i) => i.id);

    return {
      success: true,
      syncedCount: confirmedIds.length,
      batchId,
      syncedIds: confirmedIds,
      timestamp,
    };
  } catch (err) {
    // تمييز خطأ انتهاء المهلة الزمنية عن خطأ تعذر الوصول للشبكة/الخادم
    const isAbortError = err instanceof Error && err.name === "AbortError";
    const errorMessage = isAbortError
      ? "انتهت مهلة الاتصال بسيرفر المزامنة السحابي — ستبقى العمليات محفوظة محلياً."
      : "تعذر الوصول إلى سيرفر المزامنة السحابي — تأكد من تشغيل الخادم واتصال الشبكة.";

    return {
      success: false,
      syncedCount: 0,
      batchId,
      syncedIds: [],
      timestamp,
      error: errorMessage,
    };
  } finally {
    // تنظيف المؤقت دائماً سواء نجح الطلب أم فشل
    clearTimeout(timeout);
  }
};
