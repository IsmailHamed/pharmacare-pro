import { useEffect, useRef } from "react";
import { usePosStore } from "../../application/store/usePosStore";

/**
 * مستمع عالمي لقارئ الباركود الليزري (Hardware Barcode Scanner Hook)
 * يميز بين الطباعة البشرية البطيئة وبين التدفق الليزري السريع (< 45ms بين كل حرفين متبوع بـ Enter)
 */
export const useBarcodeScanner = (
  enabled: boolean = true,
  onScanComplete?: () => void,
): void => {
  const handleBarcodeScan = usePosStore((s) => s.handleBarcodeScan);
  const scannerMaxIntervalMs = usePosStore(
    (s) => s.settings?.scannerMaxIntervalMs || 45,
  );

  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;

      if (e.key === "Enter") {
        if (
          bufferRef.current.length >= 4 &&
          delta <= scannerMaxIntervalMs * 2
        ) {
          const scannedCode = bufferRef.current;
          bufferRef.current = "";
          lastKeyTimeRef.current = 0;

          e.preventDefault();
          e.stopPropagation();

          const matched = handleBarcodeScan(scannedCode);
          if (matched && onScanComplete) {
            onScanComplete();
          }
          return;
        }

        bufferRef.current = "";
        return;
      }

      if (e.key.length === 1 && /^[a-zA-Z0-9\-_]$/.test(e.key)) {
        if (delta > scannerMaxIntervalMs) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, handleBarcodeScan, scannerMaxIntervalMs, onScanComplete]);
};
