// src/infrastructure/persistence/SQLiteUserRepository.ts
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { UserEntity } from "../../domain/entities/User";
import { sqliteEngine } from "../db/database";
import { db, isTauriDesktop, sqliteRaw } from "../db/connection";

export class SQLiteUserRepository implements IUserRepository {
  async getAllUsers(): Promise<UserEntity[]> {
    return sqliteEngine.getSnapshot().users || [];
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
    // 1. تحديث حالة الذاكرة السريعة (Memory Draft)
    sqliteEngine.commit((draft) => {
      if (!draft.users) draft.users = [];
      const idx = draft.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        draft.users[idx] = user;
      } else {
        draft.users.push(user);
      }
    });

    // 2. تحديث قاعدة بيانات SQLite الفعلية (إذا كنا على Desktop)
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
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<void> {
    const user = await this.getUserById(id);
    if (user) {
      const updatedUser = { ...user, isActive };
      await this.upsertUser(updatedUser);
    }
  }
}
