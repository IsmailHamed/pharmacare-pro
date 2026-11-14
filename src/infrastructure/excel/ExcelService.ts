import * as XLSX from "xlsx";
import { ProductEntity, ControlledDrugLogEntity } from "../../domain/entities";
import { CURRENT_BRANCH_ID } from "../db/database";
import { v4 as uuidv4 } from "uuid";

/**
 * خدمة استيراد وتصدير ملفات Excel (SheetJS)
 * معزولة في طبقة البنية التحتية (Infrastructure Layer)
 */
export class ExcelService {
  /**
   * تصدير دفتر الأدوية المراقبة والنفسية إلى ملف Excel رسمي
   */
  public static exportControlledLogs(logs: ControlledDrugLogEntity[]): void {
    const rows = logs.map((l, i) => ({
      "#": i + 1,
      التاريخ: l.dispensedAt.slice(0, 19).replace("T", " "),
      الدواء: l.productName,
      "المادة الفعالة": l.scientificName,
      الباركود: l.barcode,
      الوحدة: l.unit === "pack" ? "علبة" : "شريط",
      الكمية: l.qty,
      "رقم الدفعة": l.batchNumber,
      المريض: l.patientName,
      "الرقم الوطني": l.nationalId,
      الطبيب: l.doctorName,
      "رقم الوصفة": l.prescriptionId,
      الفرع: l.branchId,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controlled Drugs");
    XLSX.writeFile(wb, `controlled-drugs-report-${Date.now()}.xlsx`);
  }

  /**
   * تصدير جرد المخزون والنواقص إلى ملف Excel
   */
  public static exportInventoryReport(products: ProductEntity[]): void {
    const rows = products.map((p, i) => ({
      "#": i + 1,
      الباركود: p.barcode,
      "الاسم التجاري": p.name,
      "المادة الفعالة": p.scientificName,
      التصنيف: p.category || "عام",
      "سعر البيع": p.packPrice,
      "التكلفة المرجحة": p.weightedCostPrice,
      "الأشرطة بالعلبة": p.stripsPerPack,
      "الرصيد (علبة)": p.stockPacks,
      "الرصيد (فرط شريط)": p.stockLooseStrips,
      "حد الطلب": p.minLimit,
      "دواء مراقب": p.isControlled ? "نعم" : "لا",
      الحالة: p.stockPacks <= p.minLimit ? "نواقص" : "متوفر",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `pharmacare-inventory-${Date.now()}.xlsx`);
  }

  /**
   * استيراد قائمة الأدوية ونشرات الأسعار من ملف Excel (.xlsx / .xls / .csv)
   */
  public static async importProductsFromExcel(
    file: File,
  ): Promise<ProductEntity[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("ملف الإكسل فارغ أو غير صالح.");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      { defval: "" },
    );

    if (rawRows.length === 0) {
      throw new Error("لم يتم العثور على أي صفوف بيانات داخل ملف الإكسل.");
    }

    const now = new Date().toISOString();
    const importedProducts: ProductEntity[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const name = String(
        row["الاسم التجاري"] ||
          row["الدواء"] ||
          row["الاسم"] ||
          row["name"] ||
          row["Name"] ||
          "",
      ).trim();

      if (!name) continue;

      const barcode = String(
        row["الباركود"] ||
          row["barcode"] ||
          row["Barcode"] ||
          `62810099${String(Date.now() + i).slice(-5)}`,
      ).trim();

      const scientificName = String(
        row["المادة الفعالة"] ||
          row["الاسم العلمي"] ||
          row["scientificName"] ||
          row["Scientific Name"] ||
          "مادة فعالة عامة",
      ).trim();

      const category = String(
        row["التصنيف"] || row["الفئة"] || row["category"] || "عام",
      ).trim();

      const packPrice = Math.max(
        0.5,
        Number(
          row["سعر البيع"] ||
            row["السعر"] ||
            row["packPrice"] ||
            row["Price"] ||
            10,
        ) || 10,
      );

      const weightedCostPrice = Math.max(
        0.1,
        Number(
          row["التكلفة المرجحة"] ||
            row["سعر الشراء"] ||
            row["التكلفة"] ||
            row["weightedCostPrice"] ||
            row["Cost"] ||
            Number((packPrice * 0.75).toFixed(2)),
        ) || Number((packPrice * 0.75).toFixed(2)),
      );

      const stripsPerPack = Math.max(
        1,
        Math.floor(
          Number(
            row["الأشرطة بالعلبة"] ||
              row["عدد الأشرطة"] ||
              row["stripsPerPack"] ||
              1,
          ) || 1,
        ),
      );

      const stockPacks = Math.max(
        0,
        Math.floor(
          Number(
            row["الرصيد (علبة)"] ||
              row["الرصيد"] ||
              row["الكمية"] ||
              row["stockPacks"] ||
              row["Stock"] ||
              0,
          ) || 0,
        ),
      );

      const stockLooseStrips = Math.max(
        0,
        Math.floor(
          Number(row["الرصيد (فرط شريط)"] || row["stockLooseStrips"] || 0) || 0,
        ),
      );

      const minLimit = Math.max(
        1,
        Math.floor(Number(row["حد الطلب"] || row["minLimit"] || 5) || 5),
      );

      const controlledRaw = String(
        row["دواء مراقب"] || row["مراقب"] || row["isControlled"] || "",
      )
        .trim()
        .toLowerCase();
      const isControlled =
        controlledRaw === "نعم" ||
        controlledRaw === "true" ||
        controlledRaw === "1" ||
        controlledRaw === "yes";

      const expiryDate = String(
        row["تاريخ الصلاحية"] ||
          row["الصلاحية"] ||
          row["expiryDate"] ||
          "2028-12-31",
      ).trim();

      const batchNumber = String(
        row["رقم الدفعة"] ||
          row["التشغيلة"] ||
          row["batchNumber"] ||
          `IMP-${new Date().getFullYear()}-${i + 1}`,
      ).trim();

      const productId = `prod-${uuidv4().slice(0, 8)}`;

      importedProducts.push({
        id: productId,
        barcode,
        name,
        scientificName,
        category,
        packPrice: Number(packPrice.toFixed(2)),
        weightedCostPrice: Number(weightedCostPrice.toFixed(2)),
        stripsPerPack,
        stockPacks,
        stockLooseStrips,
        minLimit,
        isControlled,
        branchId: CURRENT_BRANCH_ID,
        updatedAt: now,
        batches:
          stockPacks > 0
            ? [
                {
                  id: `batch-${uuidv4().slice(0, 8)}`,
                  productId,
                  batchNumber,
                  expiryDate,
                  qtyPacks: stockPacks,
                  branchId: CURRENT_BRANCH_ID,
                },
              ]
            : [],
      });
    }

    return importedProducts;
  }
}
