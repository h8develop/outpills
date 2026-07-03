import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { createHmac, randomUUID } from 'crypto';
import { IsIn, IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

class SimulateMockPaymentDto {
  @IsString()
  externalId!: string;

  @IsIn(['success', 'fail'])
  outcome!: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly providers: PaymentProviderFactory,
  ) {}

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.payments.getStatus(id);
  }

  /**
   * Webhook платёжного провайдера.
   * Защита: проверка подписи (обязательна) + идемпотентность в сервисе.
   * Rate limit повышенный, но не отключён — от флуда чужими запросами.
   */
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('webhook/:provider')
  async webhook(
    @Param('provider') providerCode: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, unknown>,
  ) {
    const provider = this.providers.byCode(providerCode);
    const rawBody = req.rawBody ?? JSON.stringify(body);
    provider.verifyWebhookSignature(rawBody, headers); // бросит 401 при невалидной подписи
    const event = provider.parseWebhook(body);
    return this.payments.handleWebhook(providerCode, event);
  }

  /**
   * Эмулятор оплаты для mock-провайдера: страница /checkout/mock-pay
   * вызывает этот endpoint вместо настоящего эквайринга. Работает ТОЛЬКО
   * при PAYMENT_PROVIDER=mock (т.е. до подключения реального провайдера).
   * Внутри идёт тот же путь, что и у боевого webhook: подпись HMAC →
   * verify → parse → handleWebhook с идемпотентностью.
   */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('mock/simulate')
  async simulateMock(@Body() dto: SimulateMockPaymentDto) {
    if ((process.env.PAYMENT_PROVIDER || 'mock') !== 'mock') {
      throw new ForbiddenException('Эмулятор доступен только с mock-провайдером');
    }
    const payload = {
      eventId: `evt_${randomUUID()}`,
      paymentId: dto.externalId,
      status: dto.outcome === 'success' ? 'SUCCEEDED' : 'FAILED',
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || '')
      .update(rawBody)
      .digest('hex');

    const provider = this.providers.byCode('mock');
    provider.verifyWebhookSignature(rawBody, { 'x-mock-signature': signature });
    const event = provider.parseWebhook(payload);
    return this.payments.handleWebhook('mock', event);
  }
}
