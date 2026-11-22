import React, { useEffect, useRef } from "react";
import { CartItemEntity } from "../../domain/entities";

interface UsePosZeroMouseShortcutsOptions {
  enabled: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  activeCartItem: CartItemEntity | undefined;
  scannerMaxIntervalMs: number;
  onIncrementQty: (cartKey: string, delta: number) => void;
  onToggleUnit: (cartKey: string) => void;
  onRemoveItem: (cartKey: string) => void;
}

/**
 * اختصارات "صفر ماوس" (Zero-Mouse POS) للتحكم المباشر بآخر صنف مضاف للسلة (cart[0])
 * (+ / - للكمية، Tab لتبديل علبة/شريط، Delete للحذف) مع حماية تدفق قارئ الباركود الليزري
 */
export const usePosZeroMouseShortcuts = ({
  enabled,
  searchQuery,
  searchInputRef,
  activeCartItem,
  scannerMaxIntervalMs,
  onIncrementQty,
  onToggleUnit,
  onRemoveItem,
}: UsePosZeroMouseShortcutsOptions): void => {
  const lastScannerCharAtRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        lastScannerCharAtRef.current = performance.now();
        return;
      }

      if (!activeCartItem) return;

      const target = e.target as HTMLElement | null;
      const isSearchInput = target === searchInputRef.current;
      const isOtherEditable =
        target &&
        !isSearchInput &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isOtherEditable) return;
      if (isSearchInput && searchQuery.trim().length > 0) return;

      const isPlus = e.key === "+" || e.code === "NumpadAdd";
      const isMinus = e.key === "-" || e.code === "NumpadSubtract";
      const isTabToggle = e.key === "Tab" && !e.shiftKey;
      const isDelete = e.key === "Delete";

      if (!isPlus && !isMinus && !isTabToggle && !isDelete) return;

      if (e.key === "-" && e.code !== "NumpadSubtract") {
        const scannerGuardMs = Math.max(120, (scannerMaxIntervalMs || 45) * 2);
        if (performance.now() - lastScannerCharAtRef.current < scannerGuardMs) {
          return;
        }
      }

      e.preventDefault();

      if (isPlus) {
        onIncrementQty(activeCartItem.cartKey, 1);
      } else if (isMinus) {
        onIncrementQty(activeCartItem.cartKey, -1);
      } else if (isTabToggle) {
        onToggleUnit(activeCartItem.cartKey);
      } else if (isDelete) {
        onRemoveItem(activeCartItem.cartKey);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    searchQuery,
    searchInputRef,
    activeCartItem,
    scannerMaxIntervalMs,
    onIncrementQty,
    onToggleUnit,
    onRemoveItem,
  ]);
};
