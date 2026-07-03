import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_KEY = 'catalog:categories';
const CACHE_TTL = 300; // 5 минут — категории меняются редко

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    const cached = await this.redis.get<unknown[]>(CACHE_KEY);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } },
    });
    await this.redis.set(CACHE_KEY, categories, CACHE_TTL);
    return categories;
  }

  async invalidateCache() {
    await this.redis.invalidatePrefix('catalog:');
  }
}
