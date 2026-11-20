import { IUserRepository } from "../../domain/repositories/IUserRepository";
import {
  UserEntity,
  UserRole,
  UserPermissions,
  ROLE_DEFAULT_PERMISSIONS,
} from "../../domain/entities/User";
import { SyncQueueItemEntity } from "../../domain/entities";
import { sqliteEngine } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";

export class SQLiteUserRepository implements IUserRepository {
  /**
   * جلب جميع الموظفين:
   * - على سطح المكتب (Tauri): القراءة المباشرة من جدول users في pharmacare.db
   * - على المتصفح (Web): القراءة من لقطة الذاكرة المحلية sqliteEngine
   */
  async getAllUsers(): Promise<UserEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM users ORDER BY created_at ASC;",
        );

        // إذا كان جدول SQLite فارغاً عند أول إقلاع، نُعيد [] ليتم زرع المدير الافتراضي وحفظه في SQLite والمزامنة
        if (rows.length === 0) {
          return [];
        }

        const mapped: UserEntity[] = rows.map((r) => {
          const role = String(r.role || "CASHIER") as UserRole;
          let parsedPermissions: Partial<UserPermissions> = {};

          try {
            parsedPermissions = JSON.parse(
              String(r.permissions_json || "{}"),
            ) as Partial<UserPermissions>;
          } catch {
            // في حال تلف JSON الصلاحيات نعود تلقائياً لقالب الدور الافتراضي
            parsedPermissions = {};
          }

          return {
            id: String(r.id),
            name: String(r.name),
            role,
            pinCode: String(r.pin_code),
            isActive: r.is_active === true || Number(r.is_active) === 1,
            permissions: {
              ...ROLE_DEFAULT_PERMISSIONS[role],
              ...parsedPermissions,
            },
            createdAt: String(r.created_at),
          };
        });

        // تحديث نسخة الذاكرة السريعة لتتطابق مع قاعدة بيانات سطح المكتب
        sqliteEngine.commit((draft) => {
          draft.users = mapped;
        });

        return mapped;
      } catch (err) {
        console.warn("Users SQLite read fallback:", err);
      }
    }

    return [...(sqliteEngine.getSnapshot().users || [])];
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    const users = await this.getAllUsers();
    return users.find((u) => u.id === id) || null;
  }

  async getUserByPin(pinCode: string): Promise<UserEntity | null> {
    const users = await this.getAllUsers();
    return users.find((u) => u.pinCode === pinCode && u.isActive) || null;
  }

  async upsertUser(user: UserEntity): Promise<void> {
    // 1. التحقق من عدم تكرار الرمز السري (PIN) لموظف آخر قبل الحفظ
    const existingUsers = await this.getAllUsers();
    const duplicatePinUser = existingUsers.find(
      (u) => u.pinCode === user.pinCode && u.id !== user.id,
    );
    if (duplicatePinUser) {
      throw new Error(
        `الرمز السري (${user.pinCode}) مستخدم بالفعل للموظف (${duplicatePinUser.name}). يرجى اختيار رمز آخر.`,
      );
    }

    // تحديد نوع العملية لطابور المزامنة (إضافة جديدة أم تعديل)
    const isExistingUser = existingUsers.some((u) => u.id === user.id);
    const syncOperation: SyncQueueItemEntity["operation"] = isExistingUser
      ? "UPDATE"
      : "INSERT";

    // 2. تحديث حالة الذاكرة السريعة (Memory Draft + Browser Snapshot)
    sqliteEngine.commit((draft) => {
      if (!draft.users) draft.users = [];
      const idx = draft.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        draft.users[idx] = user;
      } else {
        draft.users.push(user);
      }
    });

    // 3. تحديث قاعدة بيانات SQLite الفعلية (إذا كنا على سطح المكتب Tauri)
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO users (
          id, name, role, pin_code, is_active, permissions_json, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          user.id,
          user.name,
          user.role,
          user.pinCode,
          user.isActive ? 1 : 0,
          JSON.stringify(user.permissions),
          user.createdAt,
        ],
      );
    }

    // 4. إدراج التغيير في طابور المزامنة السحابية وحفظه في جدول sync_queue بـ SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "USER",
      syncOperation,
      user.id,
      user,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<void> {
    const user = await this.getUserById(id);
    if (user) {
      const updatedUser = { ...user, isActive };
      // استدعاء upsertUser يضمن تحديث الذاكرة و SQLite وطابور المزامنة معاً
      await this.upsertUser(updatedUser);
    }
  }

  /**
   * حفظ عنصر طابور المزامنة داخل جدول sync_queue في ملف pharmacare.db على سطح المكتب
   */
  private async persistSyncItemToDesktopSQLite(
    item: SyncQueueItemEntity,
  ): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    await sqliteRaw.execute(
      `INSERT OR REPLACE INTO sync_queue (
        id, entity_type, operation, record_id, payload, branch_id, status, created_at, synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        item.id,
        item.entityType,
        item.operation,
        item.recordId,
        item.payload,
        item.branchId,
        item.status,
        item.createdAt,
        item.syncedAt || null,
      ],
    );
  }
}
