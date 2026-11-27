/**
 * مولد أنماط خطوط الباركود (Code-128 Style Bars) بصيغة SVG عالية الدقة للطابعات الحرارية
 */
export const generateBarcodePattern = (code: string): number[] => {
  const clean = code.trim() || "628100000000";
  const bars: number[] = [2, 1, 1, 2, 1, 2]; // Start Guard
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    bars.push(((charCode >> 0) & 1) + 1);
    bars.push(((charCode >> 1) & 1) + 1);
    bars.push(((charCode >> 2) & 1) + 1);
    bars.push(((charCode >> 3) & 1) + 1);
  }
  bars.push(2, 1, 2, 1, 1, 2); // Stop Guard
  return bars;
};

export const buildBarcodeSvgMarkup = (code: string): string => {
  const pattern = generateBarcodePattern(code);
  const totalWidth = pattern.reduce((acc, w) => acc + w, 0);
  let currentX = 0;
  const rects: string[] = [];

  pattern.forEach((width, index) => {
    const x = currentX;
    currentX += width;
    if (index % 2 === 0) {
      rects.push(
        `<rect x="${x}" y="0" width="${width}" height="36" fill="#000000" />`,
      );
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 36" preserveAspectRatio="none" class="barcode-svg">${rects.join("")}</svg>`;
};
