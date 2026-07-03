import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Mock-провайдер для разработки и тестов.
 *
 * Поведение повторяет реальный эквайринг:
 *  - createPayment возвращает confirmationUrl (страница-эмулятор оплаты
 *    на frontend: /checkout/mock-pay?payment=...);
 *  - webhook подписывается HMAC-SHA256 ключом PAYMENT_WEBHOOK_SECRET —
 *    подпись проверяется так же строго, как у боевого провайдера;
 *  - поддерживает успех/отказ/отмену — можно прогнать все ветки flow.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly code = 'mock';

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const externalId = `mock_${randomUUID()}`;
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Эмулятор страницы оплаты живёт на frontend
    const confirmationUrl =
      `${frontend}/checkout/mock-pay?payment=${externalId}` +
      `&order=${encodeURIComponent(input.orderNumber)}&amount=${input.amount}`;
    return { externalId, confirmationUrl, status: 'PENDING' };
  }

  verifyWebhookSignature(rawBody: Buffer | string, headers: Record<string, unknown>): boolean {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('PAYMENT_WEBHOOK_SECRET не настроен');

    const provided = String(headers['x-mock-signature'] || '');
    const expected = createHmac('sha256', secret)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Невалидная подпись webhook');
    }
    return true;
  }

  parseWebhook(payload: Record<string, unknown>): NormalizedWebhookEvent {
    return {
      eventId: String(payload.eventId),
      externalPaymentId: String(payload.paymentId),
      status: payload.status as NormalizedWebhookEvent['status'],
      rawPayload: payload,
    };
  }

  async fetchPaymentStatus(): Promise<NormalizedWebhookEvent['status']> {
    return 'PENDING'; // у mock-а нет удалённого состояния
  }
}
