import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReservationExpiryWorker } from './reservation-expiry.worker';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, InventoryModule, CartModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, ReservationExpiryWorker],
  exports: [OrdersService],
})
export class OrdersModule {}
