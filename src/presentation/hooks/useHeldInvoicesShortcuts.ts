import { useEffect } from "react";
import { HeldInvoiceEntity } from "../../domain/entities";

interface UseHeldInvoicesShortcutsOptions {
  enabled: boolean;
  heldInvoices: HeldInvoiceEntity[];
  onResumeInvoice: (id: string) => void;
}

/**
 * اختصارات التبديل السريع بين تبويبات الزبائن المعلقين (Alt + 1 .. Alt + 9)
 */
export const useHeldInvoicesShortcuts = ({
  enabled,
  heldInvoices,
  onResumeInvoice,
}: UseHeldInvoicesShortcutsOptions): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      let digit: number | null = null;
      const codeMatch = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (codeMatch) {
        digit = Number(codeMatch[1]);
      } else if (/^[1-9]$/.test(e.key)) {
        digit = Number(e.key);
      }

      if (digit === null) return;

      const targetHeld = heldInvoices[digit - 1];
      if (!targetHeld) return;

      e.preventDefault();
      onResumeInvoice(targetHeld.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, heldInvoices, onResumeInvoice]);
};
