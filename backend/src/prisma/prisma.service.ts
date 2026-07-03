import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Пул соединений задаётся в DATABASE_URL:
 *   ?connection_limit=10&pool_timeout=10
 * Количество коннектов на реплику держим небольшим — при горизонтальном
 * масштабировании сумма коннектов всех реплик не должна превышать
 * max_connections Postgres (или ставим PgBouncer, см. docs/SCALING.md).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  // Graceful shutdown: закрываем пул при остановке приложения
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
