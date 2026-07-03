import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis — кеш каталога/категорий и (в scalable-проде) хранилище
 * rate-limit-счётчиков и сессий. Backend остаётся stateless:
 * всё разделяемое состояние живёт здесь или в Postgres.
 *
 * Если REDIS_URL не задан (минимальный dev-запуск) — сервис работает
 * в режиме no-op: кеш просто отключён, приложение не падает.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: false,
        enableOfflineQueue: false, // не копим команды, если Redis лежит
      });
      this.client.on('error', (err) => this.logger.warn(`Redis: ${err.message}`));
    } else {
      this.logger.warn('REDIS_URL не задан — кеширование отключено');
    }
  }

  get isEnabled(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /** Проверка для healthcheck */
  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null;
    try {
      const raw = await this.client!.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // деградация: кеш недоступен → идём в БД
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await this.client!.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* кеш недоступен — не критично */
    }
  }

  /** Инвалидация по префиксу — вызывается при изменении товаров в админке */
  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.isEnabled) return;
    try {
      const keys = await this.client!.keys(`${prefix}*`);
      if (keys.length) await this.client!.del(...keys);
    } catch {
      /* no-op */
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => undefined);
  }
}
