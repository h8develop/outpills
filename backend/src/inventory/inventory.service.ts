import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Работа с остатками. ЕДИНСТВЕННОЕ место в коде, где меняются
 * stock_quantity / reserved_quantity.
 *
 * Принцип защиты от гонки (два пользователя покупают последний товар):
 * атомарный условный UPDATE —
 *
 *   UPDATE product_variants
 *      SET reserved_quantity = reserved_quantity + :qty
 *    WHERE id = :id
 *      AND stock_quantity - reserved_quantity >= :qty
 *
 * Postgres выполняет проверку и запись под блокировкой строки, поэтому
 * из двух конкурентных запросов на последнюю единицу пройдёт ровно один:
 * второй получит rowCount = 0 → заказ не создаётся. Никакого
 * check-then-act на уровне приложения, никакого доверия количеству
 * с frontend.
 *
 * Все методы принимают `tx` — вызываются ТОЛЬКО внутри транзакции
 * создания/отмены заказа, чтобы резерв и заказ были атомарны как целое.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Зарезервировать. Возвращает false, если товара не хватает —
   * вызывающий код обязан откатить транзакцию.
   */
  async reserve(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
  ): Promise<boolean> {
    const updated = await tx.$executeRaw`
      UPDATE product_variants
         SET "reservedQuantity" = "reservedQuantity" + ${quantity},
             "updatedAt" = NOW()
       WHERE id = ${variantId}
         AND status = 'ACTIVE'
         AND "stockQuantity" - "reservedQuantity" >= ${quantity}
    `;
    if (updated === 0) return false;

    await tx.stockMovement.create({
      data: { variantId, type: 'RESERVE', quantity, orderId },
    });
    return true;
  }

  /** Снять резерв (отмена, ошибка оплаты, истечение TTL). */
  async release(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
    comment?: string,
  ): Promise<void> {
    // GREATEST(0, …) — защита от ухода резерва в минус при двойном release
    await tx.$executeRaw`
      UPDATE product_variants
         SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${quantity}),
             "updatedAt" = NOW()
       WHERE id = ${variantId}
    `;
    await tx.stockMovement.create({
      data: { variantId, type: 'RELEASE', quantity, orderId, comment },
    });
  }

  /**
   * Списать после успешной оплаты: резерв превращается в уменьшение склада.
   * stock -= qty, reserved -= qty.
   */
  async commit(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE product_variants
         SET "stockQuantity" = "stockQuantity" - ${quantity},
             "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${quantity}),
             "updatedAt" = NOW()
       WHERE id = ${variantId}
    `;
    await tx.stockMovement.create({
      data: { variantId, type: 'COMMIT', quantity, orderId },
    });

    // Автоматически помечаем вариант закончившимся
    await tx.$executeRaw`
      UPDATE product_variants
         SET status = 'OUT_OF_STOCK'
       WHERE id = ${variantId}
         AND status = 'ACTIVE'
         AND "stockQuantity" - "reservedQuantity" <= 0
    `;
  }

  /** Ручная корректировка остатков из админки (поступление партии и т.п.) */
  async adjust(variantId: string, delta: number, comment?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE product_variants
           SET "stockQuantity" = GREATEST(0, "stockQuantity" + ${delta}),
               status = CASE
                 WHEN "stockQuantity" + ${delta} > "reservedQuantity" AND status = 'OUT_OF_STOCK'
                   THEN 'ACTIVE'::"VariantStatus"
                 ELSE status
               END,
               "updatedAt" = NOW()
         WHERE id = ${variantId}
      `;
      await tx.stockMovement.create({
        data: {
          variantId,
          type: delta >= 0 ? 'RESTOCK' : 'ADJUST',
          quantity: Math.abs(delta),
          comment,
        },
      });
    });
    this.logger.log(`Склад скорректирован: variant=${variantId} delta=${delta}`);
  }
}
