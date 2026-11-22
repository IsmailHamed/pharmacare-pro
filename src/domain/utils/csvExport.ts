export type CsvCellValue = string | number | boolean | null | undefined;

/**
 * تنسيق خلية CSV بشكل آمن يعالج الفواصل والأسطر الجديدة وعلامات الاقتباس المزدوجة
 */
export const formatCsvCell = (value: CsvCellValue): string => {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
};

/**
 * توليد ملف CSV متوافق مع Microsoft Excel بترميز عربي (UTF-8 BOM) وتنزيله فوراً
 */
export const exportRowsToCsv = (options: {
  fileName: string;
  headers: string[];
  rows: CsvCellValue[][];
}): string => {
  const { fileName, headers, rows } = options;

  const normalizedFileName = fileName.toLowerCase().endsWith(".csv")
    ? fileName
    : `${fileName}.csv`;

  const headerLine = headers.map((h) => formatCsvCell(h)).join(",");
  const dataLines = rows.map((row) =>
    row.map((cell) => formatCsvCell(cell)).join(","),
  );

  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = normalizedFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return normalizedFileName;
};
