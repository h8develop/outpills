import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';
import { MockPaymentProvider } from './mock.provider';
import { CloudPaymentsProvider } from './cloudpayments.provider';
import { RobokassaProvider } from './robokassa.provider';

/**
 * Выбор активного провайдера по PAYMENT_PROVIDER.
 * Новый провайдер: реализовать интерфейс → добавить в registry. Всё.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly registry: Map<string, PaymentProvider>;

  constructor(
    mock: MockPaymentProvider,
    cloudpayments: CloudPaymentsProvider,
    robokassa: RobokassaProvider,
  ) {
    this.registry = new Map<string, PaymentProvider>([
      [mock.code, mock],
      [cloudpayments.code, cloudpayments],
      [robokassa.code, robokassa],
    ]);
  }

  /** Активный провайдер из env (по умолчанию mock) */
  active(): PaymentProvider {
    return this.byCode(process.env.PAYMENT_PROVIDER || 'mock');
  }

  byCode(code: string): PaymentProvider {
    const provider = this.registry.get(code);
    if (!provider) {
      throw new Error(`Неизвестный платёжный провайдер: ${code}`);
    }
    return provider;
  }
}
