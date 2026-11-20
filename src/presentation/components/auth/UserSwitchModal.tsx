import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { SoundFeedbackService } from "../../../infrastructure/audio/SoundFeedbackService";
import { KeyRound, X, Delete, Keyboard } from "lucide-react";

interface Props {
  onClose: () => void;
}

/**
 * استخراج الرقم (0..9) من حدث لوحة المفاتيح بتوافق كامل مع اللغة العربية والإنجليزية والـ Numpad
 */
const extractDigitFromKeyEvent = (e: KeyboardEvent): string | null => {
  if (/^[0-9]$/.test(e.key)) {
    return e.key;
  }

  // دعم الأرقام العربية الهندية (٠-٩)
  if (/^[٠-٩]$/.test(e.key)) {
    return String(e.key.charCodeAt(0) - 0x0660);
  }

  // الاعتماد على e.code للصف العلوي والـ Numpad لضمان العمل مهما كانت لغة لوحة المفاتيح
  if (!e.shiftKey) {
    const topRowMatch = /^Digit([0-9])$/.exec(e.code);
    if (topRowMatch) return topRowMatch[1];
  }

  const numpadMatch = /^Numpad([0-9])$/.exec(e.code);
  if (numpadMatch) return numpadMatch[1];

  return null;
};

export const UserSwitchModal: React.FC<Props> = ({ onClose }) => {
  const { loginWithPinOrBarcode } = usePosStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const pinRef = useRef("");
  const isSubmittingRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);

  const flashKey = useCallback((key: string) => {
    setActiveKey(key);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setActiveKey(null);
      highlightTimerRef.current = null;
    }, 130);
  }, []);

  const handleLogin = useCallback(
    async (currentPin: string) => {
      if (isSubmittingRef.current || currentPin.length === 0) return;
      isSubmittingRef.current = true;

      try {
        const success = await loginWithPinOrBarcode(currentPin);
        if (success) {
          SoundFeedbackService.playPackAdd();
          onClose();
        } else {
          SoundFeedbackService.playWarningBuzzer();
          setError(true);
          pinRef.current = "";
          setPin("");
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [loginWithPinOrBarcode, onClose],
  );

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (isSubmittingRef.current) return;
      setError(false);

      if (pinRef.current.length < 4) {
        const newPin = pinRef.current + digit;
        pinRef.current = newPin;
        setPin(newPin);
        flashKey(digit);

        if (newPin.length === 4) {
          void handleLogin(newPin);
        }
      }
    },
    [flashKey, handleLogin],
  );

  const handleDelete = useCallback(() => {
    if (isSubmittingRef.current) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setError(false);
    flashKey("BACKSPACE");
  }, [flashKey]);

  const handleClear = useCallback(() => {
    if (isSubmittingRef.current) return;
    pinRef.current = "";
    setPin("");
    setError(false);
    flashKey("CLEAR");
  }, [flashKey]);

  // إلغاء التركيز عن أي عنصر خلفي عند فتح النافذة وتنظيف مؤقت الوميض عند الإغلاق
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // الاستماع للوحة المفاتيح في مرحلة الالتقاط (capture: true) لعزل اختصارات نقطة البيع وقارئ الباركود في الخلفية
  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      // السماح باختصارات النظام والمتصفح (مثل Ctrl+R / F12) مع منع تسرب اختصارات Alt+1..9 لنقطة البيع
      if (e.ctrlKey || e.metaKey || e.key === "F12") return;

      e.preventDefault();
      e.stopPropagation();

      if (e.altKey) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Backspace") {
        handleDelete();
        return;
      }

      if (e.key === "Delete" || e.key === "Clear") {
        handleClear();
        return;
      }

      if (e.key === "Enter" || e.code === "NumpadEnter") {
        if (pinRef.current.length > 0) {
          void handleLogin(pinRef.current);
        }
        return;
      }

      const digit = extractDigitFromKeyEvent(e);
      if (digit !== null) {
        handleKeyPress(digit);
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    return () =>
      window.removeEventListener("keydown", handleWindowKeyDown, true);
  }, [handleClear, handleDelete, handleKeyPress, handleLogin, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            تسجيل الدخول / تبديل المستخدم
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق (Esc)"
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* شاشة عرض الـ PIN */}
          <div
            className={`flex justify-center gap-3 mb-6 p-4 rounded-xl border ${
              error
                ? "bg-rose-950 border-rose-800"
                : "bg-slate-950 border-slate-800"
            }`}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all ${
                  pin.length > i
                    ? error
                      ? "bg-rose-500"
                      : "bg-amber-400 scale-110"
                    : "bg-slate-700"
                }`}
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const keyStr = num.toString();
              const isPressed = activeKey === keyStr;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(keyStr)}
                  className={`h-14 border rounded-xl text-xl font-bold text-white shadow-sm transition active:scale-95 ${
                    isPressed
                      ? "bg-amber-600 border-amber-400 scale-95"
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700"
                  }`}
                >
                  {num}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleClear}
              className={`h-14 border rounded-xl text-sm font-bold transition ${
                activeKey === "CLEAR"
                  ? "bg-slate-700 border-slate-500 text-white scale-95"
                  : "bg-slate-800/50 hover:bg-slate-700 border-slate-700 text-slate-400"
              }`}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress("0")}
              className={`h-14 border rounded-xl text-xl font-bold text-white shadow-sm transition active:scale-95 ${
                activeKey === "0"
                  ? "bg-amber-600 border-amber-400 scale-95"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700"
              }`}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title="حذف آخر رقم (Backspace)"
              className={`h-14 border rounded-xl flex items-center justify-center transition active:scale-95 ${
                activeKey === "BACKSPACE"
                  ? "bg-rose-900 border-rose-500 text-white scale-95"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
              }`}
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>

          {/* تلميح دعم لوحة المفاتيح */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
            <Keyboard className="w-3.5 h-3.5 text-amber-400" />
            <span>0-9 للكتابة</span>
            <span>•</span>
            <span>Backspace حذف</span>
            <span>•</span>
            <span>Esc إغلاق</span>
          </div>
        </div>
      </div>
    </div>
  );
};
