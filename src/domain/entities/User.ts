// src/domain/entities/User.ts

export type UserRole = "ADMIN" | "PHARMACIST" | "CASHIER";

export interface UserPermissions {
  canViewCostAndProfit: boolean;
  canProcessReturn: boolean;
  canAdjustStock: boolean;
  canManagePurchases: boolean;
  canBulkPricing: boolean;
  canManageSettingsAndBackup: boolean;
}

export interface UserEntity {
  id: string;
  name: string;
  role: UserRole;
  pinCode: string;
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
}

// القوالب الافتراضية للصلاحيات حسب الدور المختار
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  ADMIN: {
    canViewCostAndProfit: true,
    canProcessReturn: true,
    canAdjustStock: true,
    canManagePurchases: true,
    canBulkPricing: true,
    canManageSettingsAndBackup: true,
  },
  PHARMACIST: {
    canViewCostAndProfit: false,
    canProcessReturn: true,
    canAdjustStock: true,
    canManagePurchases: true,
    canBulkPricing: false,
    canManageSettingsAndBackup: false,
  },
  CASHIER: {
    canViewCostAndProfit: false,
    canProcessReturn: false,
    canAdjustStock: false,
    canManagePurchases: false,
    canBulkPricing: false,
    canManageSettingsAndBackup: false,
  },
};
