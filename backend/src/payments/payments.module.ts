import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { CloudPaymentsProvider } from './providers/cloudpayments.provider';
import { RobokassaProvider } from './providers/robokassa.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    CloudPaymentsProvider,
    RobokassaProvider,
    PaymentProviderFactory,
  ],
  exports: [PaymentsService, PaymentProviderFactory],
})
export class PaymentsModule {}
