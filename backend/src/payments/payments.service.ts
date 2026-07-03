import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { NormalizedWebhookEvent } from './providers/payment-provider.interface';

/**
 * PaymentService — бизнес-логика платежей. Не знает деталей провайдеров,
 * работает через PaymentProvider-интерфейс.
 *
 * Идемпотентность webhook (две линии защиты):
 *  1. webhook_events: UNIQUE(provider, externalId) — повторное событие
 *     упирается в constraint и пропускается;
 *  2. переходы статусов: терминальный платёж (SUCCEEDED/…) не
 *     обрабатывается повторно — повторный webhook не спишет товар дважды.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly providers: PaymentProviderFactory,
  ) {}

  /** Создать платёж для заказа (вызывается из checkout) */
  async createForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(`Заказ в статусе ${order.status} — оплата невозможна`);
    }

    // Если по заказу уже есть живой платёж — возвращаем его (идемпотентность
    // повторного клика "оплатить")
    const existing = await this.prisma.payment.findFirst({
      where: { orderId, status: { in: ['PENDING', 'REQUIRES_ACTION'] } },
    });
    if (existing?.confirmationUrl) return existing;

    const provider = this.providers.active();
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: provider.code,
        amount: order.total,
        currency: 'RUB',
      },
    });

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await provider.createPayment({
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.number,
      amount: order.total,
      currency: 'RUB',
      description: `Заказ ${order.number} — outpills`,
      customerEmail: order.email,
      successUrl: process.env.PAYMENT_SUCCESS_URL || `${frontend}/checkout/success`,
      failUrl: process.env.PAYMENT_FAIL_URL || `${frontend}/checkout/fail`,
      returnUrl: process.env.PAYMENT_RETURN_URL || `${frontend}/checkout`,
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: result.externalId,
        confirmationUrl: result.confirmationUrl,
        status: result.status,
      },
    });
  }

  async getStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, orderId: true, confirmationUrl: true },
    });
    if (!payment) throw new NotFoundException('Платёж не найден');
    return payment;
  }

  /**
   * Обработка webhook. Правила:
   *  - подпись уже проверена контроллером (verifyWebhookSignature);
   *  - событие фиксируется в webhook_events (UNIQUE) — дубликат выходит сразу;
   *  - обновление платежа/заказа/склада — одна транзакция;
   *  - повторное списание невозможно: терминальные статусы не переигрываются.
   */
  async handleWebhook(providerCode: string, event: NormalizedWebhookEvent) {
    // Линия защиты 1: журнал событий
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: providerCode,
          externalId: event.eventId,
          payload: event.rawPayload as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        this.logger.warn(`Дубликат webhook ${providerCode}/${event.eventId} — пропущен`);
        return { ok: true, duplicate: true };
      }
      throw e;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { provider: providerCode, externalId: event.externalPaymentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      this.logger.error(`Webhook для неизвестного платежа: ${event.externalPaymentId}`);
      return { ok: false, reason: 'payment_not_found' };
    }

    // Линия защиты 2: терминальные статусы не переигрываем
    const terminal = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'EXPIRED'];
    if (terminal.includes(payment.status)) {
      this.logger.warn(`Платёж ${payment.id} уже в статусе ${payment.status} — webhook пропущен`);
      return { ok: true, alreadyProcessed: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: event.status,
          rawPayload: event.rawPayload as Prisma.InputJsonValue,
          ...(event.status === 'FAILED' ? { failureReason: 'Отказ провайдера' } : {}),
        },
      });

      const order = payment.order;

      if (event.status === 'SUCCEEDED') {
        // Оплата прошла: резерв → окончательное списание
        for (const item of order.items) {
          if (item.variantId) {
            await this.inventory.commit(tx, item.variantId, item.quantity, order.id);
          }
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', reservationExpiresAt: null },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, from: order.status, to: 'PAID', comment: 'Оплата подтверждена' },
        });
      } else if (['FAILED', 'CANCELLED'].includes(event.status)) {
        // Оплата не прошла: освобождаем резерв
        if (order.status === 'PENDING_PAYMENT') {
          for (const item of order.items) {
            if (item.variantId) {
              await this.inventory.release(tx, item.variantId, item.quantity, order.id, 'Оплата не прошла');
            }
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAYMENT_FAILED', reservationExpiresAt: null },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              from: order.status,
              to: 'PAYMENT_FAILED',
              comment: `Платёж: ${event.status}`,
            },
          });
        }
      }
      // REFUNDED / PENDING — только статус платежа, заказ разруливает админ
    });

    this.logger.log(`Webhook обработан: payment=${payment.id} → ${event.status}`);
    return { ok: true };
  }
}
