/**
 * Контракт платёжного провайдера.
 *
 * Checkout, orders и вся бизнес-логика зависят ТОЛЬКО от этого интерфейса.
 * Подключение CloudPayments / Робокассы / любого другого провайдера =
 * новый класс, реализующий PaymentProvider + регистрация в
 * payment-provider.factory.ts. Ни checkout, ни orders не меняются.
 */

export interface CreatePaymentInput {
  /** Внутренний id платежа (Payment.id) — используем как idempotency key */
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number; // копейки
  currency: string;
  description: string;
  customerEmail: string;
  /** Куда провайдер вернёт пользователя */
  successUrl: string;
  failUrl: string;
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** id платежа на стороне провайдера */
  externalId: string;
  /** URL, куда редиректить пользователя для оплаты */
  confirmationUrl: string;
  status: 'PENDING' | 'REQUIRES_ACTION';
}

/** Нормализованное webhook-событие — единый вид для всех провайдеров */
export interface NormalizedWebhookEvent {
  /** Уникальный id события у провайдера — ключ идемпотентности */
  eventId: string;
  externalPaymentId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
  rawPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  /** Код провайдера: "mock" | "cloudpayments" | "robokassa" */
  readonly code: string;

  /** Создать платёж у провайдера */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Проверить подпись webhook-а. Реализация обязана бросить
   * UnauthorizedException при невалидной подписи.
   */
  verifyWebhookSignature(rawBody: Buffer | string, headers: Record<string, unknown>): boolean;

  /** Привести webhook-payload провайдера к общему виду */
  parseWebhook(payload: Record<string, unknown>): NormalizedWebhookEvent;

  /** Запросить актуальный статус платежа (fallback, если webhook потерян) */
  fetchPaymentStatus(externalId: string): Promise<NormalizedWebhookEvent['status']>;
}
