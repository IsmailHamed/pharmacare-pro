import React, { useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  UserEntity,
  UserRole,
  ROLE_DEFAULT_PERMISSIONS,
  UserPermissions,
} from "../../../domain/entities/User";
import {
  Users,
  Shield,
  Plus,
  Power,
  Save,
  Edit3,
  X,
  KeyRound,
} from "lucide-react";

const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canViewCostAndProfit: "الاطلاع على التكلفة المرجحة وهامش وصافي الربح",
  canProcessReturn: "إجراء مرتجع مبيعات وصرف نقدي للعميل",
  canAdjustStock: "تسوية الجرد الفعلي وإعدام الدفعات والتوالف",
  canManagePurchases: "إدخال فواتير المشتريات وتوريد البونص",
  canBulkPricing: "تطبيق التسعير الجماعي وتعديل أسعار الأدوية",
  canManageSettingsAndBackup: "إدارة الإعدادات، الموظفين، والنسخ الاحتياطي",
};

export const StaffManagementSection: React.FC = () => {
  const { users, currentUser, addOrUpdateUser, toggleUserStatus } =
    usePosStore();
  const [editingUser, setEditingUser] = useState<Partial<UserEntity> | null>(
    null,
  );

  if (!currentUser?.permissions.canManageSettingsAndBackup) {
    return (
      <div className="w-full p-10 bg-rose-950/20 border border-rose-900/60 rounded-2xl text-rose-300 text-center">
        <Shield className="w-12 h-12 mx-auto mb-3 text-rose-400 opacity-80" />
        <h2 className="font-bold text-sm">
          غير مصرح لك بالوصول لإدارة فريق العمل والصلاحيات
        </h2>
        <p className="text-xs text-rose-400/80 mt-1">
          يرجى تبديل المستخدم إلى حساب يمتلك صلاحية إدارة النظام (مثل مدير
          النظام - PIN: 0000).
        </p>
      </div>
    );
  }

  const handleCreateNew = () => {
    setEditingUser({
      name: "",
      pinCode: "",
      role: "CASHIER",
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS["CASHIER"] },
    });
  };

  const handleRoleChange = (role: UserRole) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      role,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS[role] },
    });
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (!editingUser?.permissions) return;
    setEditingUser({
      ...editingUser,
      permissions: {
        ...editingUser.permissions,
        [key]: !editingUser.permissions[key],
      },
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.name?.trim() || !editingUser?.pinCode?.trim()) return;

    const userToSave: UserEntity = {
      id: editingUser.id || `user-${Date.now().toString().slice(-6)}`,
      name: editingUser.name.trim(),
      role: editingUser.role || "CASHIER",
      pinCode: editingUser.pinCode.trim(),
      isActive: editingUser.isActive ?? true,
      permissions:
        editingUser.permissions || ROLE_DEFAULT_PERMISSIONS["CASHIER"],
      createdAt: editingUser.createdAt || new Date().toISOString(),
    };
    await addOrUpdateUser(userToSave);
    setEditingUser(null);
  };

  return (
    <div className="w-full space-y-5">
      {/* الحاوية الرئيسية على كامل عرض الصفحة */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              إدارة فريق العمل والصلاحيات المخصصة (Multi-User RBAC)
            </h2>
            <p className="text-slate-400 text-[11px] mt-1">
              أضف الصيادلة والكاشير وحدد الرمز السري (PIN) والصلاحيات الدقيقة
              لكل موظف على حدة.
            </p>
          </div>

          <button
            onClick={handleCreateNew}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition"
          >
            <Plus className="w-4 h-4" /> إضافة موظف جديد
          </button>
        </div>

        {/* جدول الموظفين بعرض كامل */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                <th className="py-3 px-4 rounded-r-xl">اسم الموظف</th>
                <th className="py-3 px-4">الدور الوظيفي</th>
                <th className="py-3 px-4">رمز الدخول (PIN)</th>
                <th className="py-3 px-4">الصلاحيات الممنوحة</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center rounded-l-xl">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-950/40 transition">
                  <td className="py-3.5 px-4 text-white font-bold">
                    {user.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                      {user.role === "ADMIN"
                        ? "مدير النظام"
                        : user.role === "PHARMACIST"
                          ? "صيدلي"
                          : "كاشير"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      {user.pinCode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-slate-300">
                    <div className="flex flex-wrap gap-1.5">
                      {user.permissions.canViewCostAndProfit && (
                        <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                          رؤية الأرباح والتكلفة
                        </span>
                      )}
                      {user.permissions.canAdjustStock && (
                        <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-md">
                          تسوية الجرد والتوالف
                        </span>
                      )}
                      {user.permissions.canManagePurchases && (
                        <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                          إدارة المشتريات
                        </span>
                      )}
                      {user.permissions.canProcessReturn && (
                        <span className="bg-sky-950/60 text-sky-300 border border-sky-800/60 px-2 py-0.5 rounded-md">
                          مرتجع المبيعات
                        </span>
                      )}
                      {user.permissions.canBulkPricing && (
                        <span className="bg-purple-950/60 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md">
                          التسعير الجماعي
                        </span>
                      )}
                      {user.permissions.canManageSettingsAndBackup && (
                        <span className="bg-rose-950/60 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-md">
                          إدارة النظام والنسخ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        user.isActive
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {user.isActive ? "نشط" : "مجمد"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> تعديل
                      </button>
                      <button
                        onClick={() => void toggleUserStatus(user.id)}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition ${
                          user.isActive
                            ? "bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800"
                            : "bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {user.isActive ? "تجميد" : "تفعيل"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* النافذة المنبثقة (Modal) لإضافة أو تعديل موظف */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => void handleSave(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            {/* ترويسة النافذة */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                {editingUser.id
                  ? `تعديل بيانات وصلاحيات: ${editingUser.name}`
                  : "إضافة موظف جديد إلى النظام"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* جسم النافذة */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    اسم الموظف *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: د. أحمد - صيدلي مسائي"
                    value={editingUser.name || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    الرمز السري (4 أرقام PIN) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="مثال: 1234"
                    value={editingUser.pinCode || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        pinCode: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-center tracking-widest outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    القالب الوظيفي الأساسي
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) =>
                      handleRoleChange(e.target.value as UserRole)
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                  >
                    <option value="ADMIN">مدير النظام (كامل الصلاحيات)</option>
                    <option value="PHARMACIST">صيدلي (صلاحيات متوسطة)</option>
                    <option value="CASHIER">كاشير (مبيعات فقط)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2.5">
                  تخصيص الصلاحيات الدقيقة لهذا الموظف:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {(
                    Object.keys(PERMISSION_LABELS) as (keyof UserPermissions)[]
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition"
                    >
                      <span className="text-xs text-slate-200 font-medium">
                        {PERMISSION_LABELS[key]}
                      </span>
                      <input
                        type="checkbox"
                        checked={editingUser.permissions?.[key] || false}
                        onChange={() => handleTogglePermission(key)}
                        className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* تذييل النافذة وأزرار الحفظ */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition"
              >
                <Save className="w-4 h-4" /> حفظ واعتماد الصلاحيات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
