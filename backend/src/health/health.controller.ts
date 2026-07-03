import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Healthcheck-и (вне префикса /api):
 *  GET /health        — полная проверка: процесс + БД + Redis
 *  GET /health/live   — liveness: процесс жив (для k8s liveness probe)
 *  GET /health/ready  — readiness: готов принимать трафик (БД доступна)
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async health() {
    const [db, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const ok = db; // Redis опционален: без него — деградация, не отказ
    const body = {
      status: ok ? 'ok' : 'error',
      checks: {
        database: db ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const db = await this.checkDb();
    if (!db) throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' });
    return { status: 'ready' };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
