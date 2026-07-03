import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * ЗАГОТОВКА под CloudPayments — НЕ подключена.
 *
 * Что нужно сделать при интеграции (checkout/orders трогать НЕ придётся):
 *  1. env: PAYMENT_PROVIDER=cloudpayments, CLOUDPAYMENTS_PUBLIC_ID,
 *     CLOUDPAYMENTS_API_SECRET.
 *  2. createPayment: CloudPayments работает через виджет — вернуть
 *     confirmationUrl на страницу frontend с виджетом (publicId + invoiceId
 *     = наш paymentId) либо использовать API "orders" для ссылок на оплату.
 *  3. verifyWebhookSignature: HMAC-SHA256 тела запроса ключом API Secret,
 *     сравнение с заголовком Content-HMAC (у CP — X-Content-HMAC).
 *  4. parseWebhook: маппинг событий Pay/Fail/Cancel/Refund на общий вид
 *     (SUCCEEDED/FAILED/CANCELLED/REFUNDED); eventId = TransactionId.
 *  5. fetchPaymentStatus: POST /payments/get c TransactionId.
 *  6. Зарегистрировать в payment-provider.factory.ts.
 * Документация: https://developers.cloudpayments.ru/
 */
@Injectable()
export class CloudPaymentsProvider implements PaymentProvider {
  readonly code = 'cloudpayments';

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedException('CloudPayments ещё не подключён — см. комментарий в файле');
  }

  verifyWebhookSignature(): boolean {
    throw new NotImplementedException('CloudPayments ещё не подключён');
  }

  parseWebhook(): NormalizedWebhookEvent {
    throw new NotImplementedException('CloudPayments ещё не подключён');
  }

  async fetchPaymentStatus(): Promise<NormalizedWebhookEvent['status']> {
    throw new NotImplementedException('CloudPayments ещё не подключён');
  }
}
