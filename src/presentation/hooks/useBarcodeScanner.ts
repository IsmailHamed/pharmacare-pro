import { useEffect, useRef } from "react";
import { usePosStore } from "../../application/store/usePosStore";

/**
 * مستمع عالمي لقارئ الباركود الليزري (Hardware Barcode Scanner Hook)
 * يميز بين الطباعة البشرية البطيئة وبين التدفق الليزري السريع (< 45ms بين كل حرفين متبوع بـ Enter)
 * يدعم معالجاً مخصصاً (customScanHandler) لاستخدامه في شاشة المشتريات أو غيرها دون كسر نقطة البيع
 */
export const useBarcodeScanner = (
  enabled: boolean = true,
  onScanComplete?: () => void,
  customScanHandler?: (scannedCode: string) => boolean,
): void => {
  const handleBarcodeScan = usePosStore((s) => s.handleBarcodeScan);
  const scannerMaxIntervalMs = usePosStore(
    (s) => s.settings?.scannerMaxIntervalMs || 45,
  );

  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const onScanCompleteRef = useRef(onScanComplete);
  const customScanHandlerRef = useRef(customScanHandler);

  useEffect(() => {
    onScanCompleteRef.current = onScanComplete;
    customScanHandlerRef.current = customScanHandler;
  }, [onScanComplete, customScanHandler]);

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

          const handler = customScanHandlerRef.current || handleBarcodeScan;
          const matched = handler(scannedCode);
          if (matched && onScanCompleteRef.current) {
            onScanCompleteRef.current();
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
  }, [enabled, handleBarcodeScan, scannerMaxIntervalMs]);
};
