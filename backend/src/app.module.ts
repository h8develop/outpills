import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // Rate limiting. In-memory на реплику; для многорепличного прода —
    // Redis-storage (см. docs/SCALING.md)
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW || 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
      },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    StorageModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
