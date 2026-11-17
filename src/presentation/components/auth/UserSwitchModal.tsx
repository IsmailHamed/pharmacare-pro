import React, { useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { KeyRound, X, Delete } from "lucide-react";

interface Props {
  onClose: () => void;
}

export const UserSwitchModal: React.FC<Props> = ({ onClose }) => {
  const { loginWithPinOrBarcode } = usePosStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleKeyPress = (key: string) => {
    if (error) setError(false);
    if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleLogin = async (currentPin: string) => {
    const success = await loginWithPinOrBarcode(currentPin);
    if (success) {
      onClose();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            تسجيل الدخول / تبديل المستخدم
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* شاشة عرض الـ PIN */}
          <div
            className={`flex justify-center gap-3 mb-6 p-4 rounded-xl border ${error ? "bg-rose-950 border-rose-800" : "bg-slate-950 border-slate-800"}`}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all ${pin.length > i ? (error ? "bg-rose-500" : "bg-amber-400") : "bg-slate-700"}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-rose-400 text-xs text-center mb-4 font-bold">
              الرمز السري غير صحيح أو الحساب مجمد!
            </p>
          )}

          {/* لوحة الأرقام (Numpad) */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num.toString())}
                className="h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xl font-bold text-white shadow-sm transition active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => {
                setPin("");
                setError(false);
              }}
              className="h-14 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-bold text-slate-400 transition"
            >
              إلغاء
            </button>
            <button
              onClick={() => handleKeyPress("0")}
              className="h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xl font-bold text-white shadow-sm transition active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center text-slate-300 transition active:scale-95"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
