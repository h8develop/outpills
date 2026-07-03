import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

/**
 * Фоновая задача: заказы, не оплаченные за RESERVATION_TTL_MINUTES,
 * переводятся в EXPIRED, резерв освобождается, незавершённые платежи
 * помечаются EXPIRED.
 *
 * MVP: cron внутри процесса API (@nestjs/schedule). При нескольких
 * репликах включайте воркер только на одной (env RUN_WORKERS=1) или
 * выносите в отдельный процесс/очередь BullMQ — см. docs/SCALING.md.
 * Гонки между двумя воркерами всё равно безопасны: перевод статуса
 * делается условным updateMany (WHERE status = PENDING_PAYMENT).
 */
@Injectable()
export class ReservationExpiryWorker {
  private readonly logger = new Logger(ReservationExpiryWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredReservations() {
    if (process.env.RUN_WORKERS === '0') return; // реплика без воркеров

    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', reservationExpiresAt: { lt: new Date() } },
      include: { items: true },
      take: 100, // порциями — не держим долгих транзакций
    });

    for (const order of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Условный переход — защита от двойной обработки при гонке
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING_PAYMENT' },
            data: { status: 'EXPIRED', reservationExpiresAt: null },
          });
          if (updated.count === 0) return; // кто-то уже обработал

          for (const item of order.items) {
            if (item.variantId) {
              await this.inventory.release(tx, item.variantId, item.quantity, order.id, 'TTL резерва истёк');
            }
          }
          await tx.payment.updateMany({
            where: { orderId: order.id, status: { in: ['PENDING', 'REQUIRES_ACTION'] } },
            data: { status: 'EXPIRED' },
          });
          await tx.orderStatusHistory.create({
            data: { orderId: order.id, from: 'PENDING_PAYMENT', to: 'EXPIRED', comment: 'Оплата не завершена вовремя' },
          });
        });
        this.logger.log(`Резерв снят: заказ ${order.number} → EXPIRED`);
      } catch (e) {
        this.logger.error(`Ошибка снятия резерва по заказу ${order.number}`, (e as Error).stack);
      }
    }
  }
}
