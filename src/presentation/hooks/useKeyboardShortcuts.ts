import { useHotkeys } from "react-hotkeys-hook";

interface ShortcutHandlers {
  onCheckout: () => void; // F1 بيع وطباعة
  onFocusSearch: () => void; // F2 البحث
  onAlternatives: () => void; // F4 البدائل
  onHoldResume: () => void; // F5 تعليق/استئناف الفاتورة
  onReturn: () => void; // F6 المرتجع
}

/**
 * اختصارات نقطة البيع السريعة (Keyboard-First POS)
 * F1 بيع | F2 بحث | F4 بدائل | F5 تعليق/استئناف | F6 مرتجع
 */
export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  const opts = { enableOnFormTags: true } as const;

  useHotkeys(
    "f1",
    (e) => {
      e.preventDefault();
      handlers.onCheckout();
    },
    opts,
  );
  useHotkeys(
    "f2",
    (e) => {
      e.preventDefault();
      handlers.onFocusSearch();
    },
    opts,
  );
  useHotkeys(
    "f4",
    (e) => {
      e.preventDefault();
      handlers.onAlternatives();
    },
    opts,
  );
  useHotkeys(
    "f5",
    (e) => {
      e.preventDefault();
      handlers.onHoldResume();
    },
    opts,
  );
  useHotkeys(
    "f6",
    (e) => {
      e.preventDefault();
      handlers.onReturn();
    },
    opts,
  );
};
