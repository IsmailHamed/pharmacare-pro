import React, { useMemo } from "react";
import { generateBarcodePattern } from "../../../../domain/utils/printTemplates";

interface Props {
  code: string;
  className?: string;
  height?: number;
}

/**
 * مكوّن SVG مشترك لرسم خطوط الباركود (Code-128 Style) بدقة عالية للمعاينة والطباعة الحرارية
 */
export const BarcodeSvg: React.FC<Props> = ({
  code,
  className = "w-4/5 h-7 mx-auto mb-1",
  height = 36,
}) => {
  const { totalWidth, bars } = useMemo(() => {
    const pattern = generateBarcodePattern(code);
    let currentX = 0;
    const rects: Array<{ x: number; width: number }> = [];

    pattern.forEach((width, idx) => {
      const x = currentX;
      currentX += width;
      if (idx % 2 === 0) {
        rects.push({ x, width });
      }
    });

    return { totalWidth: currentX || 1, bars: rects };
  }, [code]);

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {bars.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x}
          y={0}
          width={bar.width}
          height={height}
          fill="#000000"
        />
      ))}
    </svg>
  );
};
