import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * ЗАГОТОВКА под Робокассу — НЕ подключена.
 *
 * Что нужно сделать при интеграции (checkout/orders трогать НЕ придётся):
 *  1. env: PAYMENT_PROVIDER=robokassa, ROBOKASSA_MERCHANT_LOGIN,
 *     ROBOKASSA_PASSWORD_1, ROBOKASSA_PASSWORD_2.
 *  2. createPayment: собрать ссылку на оплату
 *     https://auth.robokassa.ru/Merchant/Index.aspx с параметрами
 *     MerchantLogin, OutSum, InvId (наш числовой id), SignatureValue =
 *     MD5(login:OutSum:InvId:password1).
 *  3. verifyWebhookSignature (ResultURL): проверить SignatureValue =
 *     MD5(OutSum:InvId:password2), регистронезависимо.
 *  4. parseWebhook: ResultURL приходит form-encoded; успех = валидная
 *     подпись; eventId = InvId + OutSum.
 *  5. fetchPaymentStatus: XML-интерфейс OpState.
 *  6. Зарегистрировать в payment-provider.factory.ts.
 * Документация: https://docs.robokassa.ru/
 */
@Injectable()
export class RobokassaProvider implements PaymentProvider {
  readonly code = 'robokassa';

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedException('Робокасса ещё не подключена — см. комментарий в файле');
  }

  verifyWebhookSignature(): boolean {
    throw new NotImplementedException('Робокасса ещё не подключена');
  }

  parseWebhook(): NormalizedWebhookEvent {
    throw new NotImplementedException('Робокасса ещё не подключена');
  }

  async fetchPaymentStatus(): Promise<NormalizedWebhookEvent['status']> {
    throw new NotImplementedException('Робокасса ещё не подключена');
  }
}
