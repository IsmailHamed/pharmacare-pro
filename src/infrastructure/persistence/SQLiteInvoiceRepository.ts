import { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import {
  CashExpenseEntity,
  ControlledDrugLogEntity,
  LedgerPaymentEntity,
  PurchaseInvoiceEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
} from "../../domain/entities";
import { sqliteEngine } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";
import {
  mapControlledDrugLogRow,
  mapExpenseRow,
  mapInvoiceRow,
  mapLedgerPaymentRow,
  mapPurchaseInvoiceRow,
  mapShiftRow,
  mapSyncQueueRow,
  recalculateShiftExpectedCash,
} from "./invoiceMappers";

export class SQLiteInvoiceRepository implements IInvoiceRepository {
  async saveInvoice(invoice: InvoiceEntity): Promise<void> {
    let updatedOpenShift: ShiftSummaryEntity | null = null;

    sqliteEngine.commit((draft) => {
      draft.invoices.unshift(invoice);

      const openShift = draft.shifts.find((s) => s.status === "OPEN");
      if (openShift) {
        if (invoice.type === "SALE") {
          if (invoice.paymentMode === "CASH") {
            openShift.cashSalesTotal = Number(
              (openShift.cashSalesTotal + invoice.totalAmount).toFixed(2),
            );
          } else {
            openShift.creditSalesTotal = Number(
              (openShift.creditSalesTotal + invoice.totalAmount).toFixed(2),
            );
          }
        } else if (invoice.type === "RETURN") {
          // التفريق المحاسبي بين المرتجع النقدي والمرتجع الآجل
          if (invoice.paymentMode === "CASH") {
            openShift.returnsTotal = Number(
              (openShift.returnsTotal + invoice.totalAmount).toFixed(2),
            );
          } else {
            openShift.creditReturnsTotal = Number(
              (
                (openShift.creditReturnsTotal || 0) + invoice.totalAmount
              ).toFixed(2),
            );
          }
        }

        recalculateShiftExpectedCash(openShift);
        updatedOpenShift = { ...openShift };
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO invoices (
          id, type, payment_mode, customer_name, subtotal, discount_percent,
          total_amount, total_cost_amount, net_profit, items_json, created_at,
          shift_id, performed_by_user_id, performed_by_name, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
        [
          invoice.id,
          invoice.type,
          invoice.paymentMode,
          invoice.customerName,
          invoice.subtotal,
          invoice.discountPercent,
          invoice.totalAmount,
          invoice.totalCostAmount ?? 0,
          invoice.netProfit ?? 0,
          JSON.stringify(invoice.items),
          invoice.createdAt,
          invoice.shiftId || null,
          invoice.performedByUserId || null,
          invoice.performedByName || null,
          invoice.branchId,
        ],
      );

      if (updatedOpenShift) {
        await this.persistShiftToDesktopSQLite(updatedOpenShift);
      }
    }

    const syncItem = sqliteEngine.enqueueSync(
      "INVOICE",
      "INSERT",
      invoice.id,
      invoice,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getAllInvoices(): Promise<InvoiceEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM invoices ORDER BY created_at DESC;",
        );
        if (rows.length > 0) {
          const mapped = rows.map(mapInvoiceRow);
          sqliteEngine.commit((draft) => {
            draft.invoices = mapped;
          });
          return mapped;
        }
      } catch (err) {
        console.warn("Invoices SQLite read fallback:", err);
      }
    }
    return [...sqliteEngine.getSnapshot().invoices];
  }

  async savePurchaseInvoice(purchase: PurchaseInvoiceEntity): Promise<void> {
    let updatedOpenShift: ShiftSummaryEntity | null = null;

    sqliteEngine.commit((draft) => {
      draft.purchaseInvoices.unshift(purchase);

      // إذا دُفعت فاتورة المشتريات نقداً من الدرج، تُخصم من النقد المتوقع للوردية
      const openShift = draft.shifts.find((s) => s.status === "OPEN");
      if (openShift && purchase.paymentMode === "CASH") {
        openShift.cashPurchasesTotal = Number(
          ((openShift.cashPurchasesTotal || 0) + purchase.totalAmount).toFixed(
            2,
          ),
        );
        recalculateShiftExpectedCash(openShift);
        updatedOpenShift = { ...openShift };
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO purchase_invoices (
          id, supplier_name, supplier_invoice_number, payment_mode,
          total_amount, total_bonus_value, items_json, purchase_order_id, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          purchase.id,
          purchase.supplierName,
          purchase.supplierInvoiceNumber,
          purchase.paymentMode,
          purchase.totalAmount,
          purchase.totalBonusValue,
          JSON.stringify(purchase.items),
          purchase.purchaseOrderId || null,
          purchase.createdAt,
          purchase.branchId,
        ],
      );

      if (updatedOpenShift) {
        await this.persistShiftToDesktopSQLite(updatedOpenShift);
      }
    }

    const syncItem = sqliteEngine.enqueueSync(
      "PURCHASE",
      "INSERT",
      purchase.id,
      purchase,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getAllPurchaseInvoices(): Promise<PurchaseInvoiceEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM purchase_invoices ORDER BY created_at DESC;",
        );
        if (rows.length > 0) {
          const mapped = rows.map(mapPurchaseInvoiceRow);
          sqliteEngine.commit((draft) => {
            draft.purchaseInvoices = mapped;
          });
          return mapped;
        }
      } catch (err) {
        console.warn("Purchase invoices SQLite read fallback:", err);
      }
    }
    return [...sqliteEngine.getSnapshot().purchaseInvoices];
  }

  async saveControlledDrugLog(log: ControlledDrugLogEntity): Promise<void> {
    sqliteEngine.commit((draft) => {
      draft.controlledLogs.unshift(log);
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO controlled_drug_logs (
          id, invoice_id, product_id, product_name, scientific_name,
          barcode, unit, qty, batch_number, patient_name, national_id,
          doctor_name, prescription_id, dispensed_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
        [
          log.id,
          log.invoiceId,
          log.productId,
          log.productName,
          log.scientificName,
          log.barcode,
          log.unit,
          log.qty,
          log.batchNumber,
          log.patientName,
          log.nationalId,
          log.doctorName,
          log.prescriptionId,
          log.dispensedAt,
          log.branchId,
        ],
      );
    }

    const syncItem = sqliteEngine.enqueueSync(
      "CONTROLLED_LOG",
      "INSERT",
      log.id,
      log,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getControlledDrugLogs(): Promise<ControlledDrugLogEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM controlled_drug_logs ORDER BY dispensed_at DESC;",
        );
        const mapped = rows.map(mapControlledDrugLogRow);
        sqliteEngine.commit((draft) => {
          draft.controlledLogs = mapped;
        });
        return mapped;
      } catch (err) {
        console.warn("Controlled drug logs SQLite read fallback:", err);
      }
    }

    return [...sqliteEngine.getSnapshot().controlledLogs];
  }

  async saveExpense(expense: CashExpenseEntity): Promise<void> {
    let updatedOpenShift: ShiftSummaryEntity | null = null;

    sqliteEngine.commit((draft) => {
      draft.expenses.unshift(expense);

      const openShift = draft.shifts.find((s) => s.status === "OPEN");
      // لا نخصم من نقد درج الكاشير إذا كان القيد خسارة تالف/جرد مخزني
      if (openShift && expense.shiftId !== "INVENTORY-LOSS") {
        openShift.pettyCashTotal = Number(
          (openShift.pettyCashTotal + expense.amount).toFixed(2),
        );
        recalculateShiftExpectedCash(openShift);
        updatedOpenShift = { ...openShift };
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO cash_expenses (
          id, title, category, amount, notes, shift_id,
          performed_by_user_id, performed_by_name, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          expense.id,
          expense.title,
          expense.category,
          expense.amount,
          expense.notes || null,
          expense.shiftId,
          expense.performedByUserId || null,
          expense.performedByName || null,
          expense.createdAt,
          expense.branchId,
        ],
      );

      if (updatedOpenShift) {
        await this.persistShiftToDesktopSQLite(updatedOpenShift);
      }
    }

    const syncItem = sqliteEngine.enqueueSync(
      "EXPENSE",
      "INSERT",
      expense.id,
      expense,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getAllExpenses(): Promise<CashExpenseEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM cash_expenses ORDER BY created_at DESC;",
        );
        const mapped = rows.map(mapExpenseRow);
        sqliteEngine.commit((draft) => {
          draft.expenses = mapped;
        });
        return mapped;
      } catch (err) {
        console.warn("Cash expenses SQLite read fallback:", err);
      }
    }

    return [...sqliteEngine.getSnapshot().expenses];
  }

  async saveShift(shift: ShiftSummaryEntity): Promise<void> {
    sqliteEngine.commit((draft) => {
      const idx = draft.shifts.findIndex((s) => s.id === shift.id);
      if (idx >= 0) {
        draft.shifts[idx] = shift;
      } else {
        draft.shifts.unshift(shift);
      }
    });

    await this.persistShiftToDesktopSQLite(shift);

    const syncItem = sqliteEngine.enqueueSync(
      "SHIFT",
      "UPDATE",
      shift.id,
      shift,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getShifts(): Promise<ShiftSummaryEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM shifts ORDER BY opened_at DESC;",
        );
        if (rows.length > 0) {
          const mapped = rows.map(mapShiftRow);
          sqliteEngine.commit((draft) => {
            draft.shifts = mapped;
          });
          return mapped;
        }
      } catch (err) {
        console.warn("Shifts SQLite read fallback:", err);
      }
    }
    return [...sqliteEngine.getSnapshot().shifts];
  }

  async getSyncQueue(): Promise<SyncQueueItemEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM sync_queue ORDER BY created_at DESC;",
        );
        const mapped = rows.map(mapSyncQueueRow);
        sqliteEngine.commit((draft) => {
          draft.syncQueue = mapped;
        });
        return mapped;
      } catch (err) {
        console.warn("SyncQueue SQLite read fallback:", err);
      }
    }

    return [...sqliteEngine.getSnapshot().syncQueue];
  }

  async markSyncItemsCompleted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const idSet = new Set(ids);

    sqliteEngine.commit((draft) => {
      draft.syncQueue.forEach((item) => {
        if (idSet.has(item.id)) {
          item.status = "SYNCED";
          item.syncedAt = now;
        }
      });
    });

    if (isTauriDesktop() && sqliteRaw) {
      for (const id of ids) {
        await sqliteRaw.execute(
          "UPDATE sync_queue SET status = 'SYNCED', synced_at = $1 WHERE id = $2;",
          [now, id],
        );
      }
    }
  }

  async saveLedgerPayment(payment: LedgerPaymentEntity): Promise<void> {
    let updatedOpenShift: ShiftSummaryEntity | null = null;

    sqliteEngine.commit((draft) => {
      if (!draft.ledgerPayments) draft.ledgerPayments = [];
      draft.ledgerPayments.unshift(payment);

      // فصل مقبوضات العملاء ومدفوعات الموردين في بنود مستقلة داخل الوردية
      const openShift = draft.shifts.find((s) => s.status === "OPEN");
      if (openShift) {
        if (payment.partyType === "CUSTOMER") {
          openShift.debtCollectionsTotal = Number(
            ((openShift.debtCollectionsTotal || 0) + payment.amount).toFixed(2),
          );
        } else {
          openShift.supplierPaymentsTotal = Number(
            ((openShift.supplierPaymentsTotal || 0) + payment.amount).toFixed(
              2,
            ),
          );
        }
        recalculateShiftExpectedCash(openShift);
        updatedOpenShift = { ...openShift };
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO ledger_payments (
          id, party_type, party_name, amount, notes, shift_id,
          performed_by_user_id, performed_by_name, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          payment.id,
          payment.partyType,
          payment.partyName,
          payment.amount,
          payment.notes || null,
          payment.shiftId || null,
          payment.performedByUserId || null,
          payment.performedByName || null,
          payment.createdAt,
          payment.branchId,
        ],
      );

      if (updatedOpenShift) {
        await this.persistShiftToDesktopSQLite(updatedOpenShift);
      }
    }

    const syncItem = sqliteEngine.enqueueSync(
      "LEDGER_PAYMENT",
      "INSERT",
      payment.id,
      payment,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async getLedgerPayments(): Promise<LedgerPaymentEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM ledger_payments ORDER BY created_at DESC;",
        );
        if (rows.length > 0) {
          const mapped = rows.map(mapLedgerPaymentRow);
          sqliteEngine.commit((draft) => {
            draft.ledgerPayments = mapped;
          });
          return mapped;
        }
      } catch (err) {
        console.warn("Ledger payments SQLite read fallback:", err);
      }
    }
    return [...(sqliteEngine.getSnapshot().ledgerPayments || [])];
  }

  private async persistShiftToDesktopSQLite(
    shift: ShiftSummaryEntity,
  ): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    await sqliteRaw.execute(
      `INSERT OR REPLACE INTO shifts (
        id, pharmacist_name, opened_by_user_id, opened_at, closed_at,
        closed_by_user_id, closed_by_name, status,
        opening_balance, cash_sales_total, credit_sales_total,
        returns_total, credit_returns_total, debt_collections_total,
        supplier_payments_total, cash_purchases_total, petty_cash_total,
        expected_drawer_cash, actual_drawer_cash, variance,
        safe_drop_amount, next_shift_float, branch_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      );`,
      [
        shift.id,
        shift.pharmacistName,
        shift.openedByUserId || null,
        shift.openedAt,
        shift.closedAt || null,
        shift.closedByUserId || null,
        shift.closedByName || null,
        shift.status,
        shift.openingBalance,
        shift.cashSalesTotal,
        shift.creditSalesTotal,
        shift.returnsTotal,
        shift.creditReturnsTotal ?? 0,
        shift.debtCollectionsTotal ?? 0,
        shift.supplierPaymentsTotal ?? 0,
        shift.cashPurchasesTotal ?? 0,
        shift.pettyCashTotal,
        shift.expectedDrawerCash,
        shift.actualDrawerCash ?? null,
        shift.variance ?? null,
        shift.safeDropAmount ?? 0,
        shift.nextShiftFloat ?? 0,
        shift.branchId,
      ],
    );
  }

  private async persistSyncItemToDesktopSQLite(
    item: SyncQueueItemEntity,
  ): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    await sqliteRaw.execute(
      `INSERT OR REPLACE INTO sync_queue (
        id, entity_type, operation, record_id, payload, branch_id, status, created_at, synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        item.id,
        item.entityType,
        item.operation,
        item.recordId,
        item.payload,
        item.branchId,
        item.status,
        item.createdAt,
        item.syncedAt || null,
      ],
    );
  }
}
