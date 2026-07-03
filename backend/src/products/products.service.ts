import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { ListProductsDto } from './dto/list-products.dto';
import { paginate } from '../common/pagination.dto';

const LIST_CACHE_TTL = 60; // список каталога: 60 сек
const PRODUCT_CACHE_TTL = 120; // карточка: 2 мин (остатки берутся отдельно)

/**
 * Публичный каталог. Кешируем листинги и карточки в Redis; при любом
 * изменении товара из админки кеш инвалидируется по префиксу catalog:*.
 * ВАЖНО: остатки в ответе — ориентировочные (для витрины). Правда об
 * остатках проверяется заново на checkout атомарным UPDATE.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async findAll(dto: ListProductsDto) {
    const cacheKey = `catalog:list:${JSON.stringify(dto)}`;
    const cached = await this.redis.get<object>(cacheKey);
    if (cached) return cached;

    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      ...(dto.category ? { category: { slug: dto.category } } : {}),
      ...(dto.gender ? { gender: dto.gender as any } : {}),
      ...(dto.collection ? { collection: dto.collection } : {}),
      ...(dto.q
        ? {
            OR: [
              { name: { contains: dto.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: dto.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(dto.size || dto.color || dto.inStock
        ? {
            variants: {
              some: {
                ...(dto.size ? { size: dto.size } : {}),
                ...(dto.color ? { color: dto.color } : {}),
                ...(dto.inStock ? { status: 'ACTIVE' } : {}),
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      dto.sort === 'price_asc'
        ? { basePrice: 'asc' }
        : dto.sort === 'price_desc'
          ? { basePrice: 'desc' }
          : { createdAt: 'desc' };

    // Один findMany с include — вместо N+1 по картинкам/вариантам
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: dto.skip,
        take: dto.limit,
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 2 },
          variants: {
            select: { id: true, size: true, color: true, colorHex: true, status: true },
          },
          category: { select: { slug: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = paginate(items.map((p) => this.toPublic(p)), total, dto);
    await this.redis.set(cacheKey, result, LIST_CACHE_TTL);
    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `catalog:product:${slug}`;
    let product = await this.redis.get<any>(cacheKey);

    if (!product) {
      const found = await this.prisma.product.findFirst({
        where: { slug, status: 'PUBLISHED' },
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          category: { select: { slug: true, name: true } },
        },
      });
      if (!found) throw new NotFoundException('Товар не найден');
      product = this.toPublic(found);
      await this.redis.set(cacheKey, product, PRODUCT_CACHE_TTL);
    }

    // Остатки НЕ кешируем вместе с карточкой — читаем всегда свежие
    const variants = await this.prisma.productVariant.findMany({
      where: { productId: product.id, status: { not: 'HIDDEN' } },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        colorHex: true,
        status: true,
        stockQuantity: true,
        reservedQuantity: true,
      },
      orderBy: [{ color: 'asc' }, { size: 'asc' }],
    });

    return {
      ...product,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        // наружу отдаём только available — внутренняя механика скрыта
        available: Math.max(0, v.stockQuantity - v.reservedQuantity),
        inStock: v.status === 'ACTIVE' && v.stockQuantity - v.reservedQuantity > 0,
      })),
    };
  }

  /** Похожие товары — та же категория, кроме текущего */
  async findSimilar(slug: string, take = 4) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true },
    });
    if (!product) return [];
    const items = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED', categoryId: product.categoryId, id: { not: product.id } },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
        variants: {
          select: { id: true, size: true, color: true, colorHex: true, status: true },
        },
      },
    });
    return items.map((p) => this.toPublic(p));
  }

  async invalidateCache() {
    await this.redis.invalidatePrefix('catalog:');
  }

  /** Публичное представление: цены наружу, ключи картинок → URL (CDN-ready) */
  private toPublic(p: any) {
    const saleActive =
      p.salePrice != null &&
      (!p.saleStartsAt || p.saleStartsAt <= new Date()) &&
      (!p.saleEndsAt || p.saleEndsAt >= new Date());
    return {
      ...p,
      images: (p.images || []).map((img: any) => ({
        ...img,
        url: this.storage.publicUrl(img.objectKey),
      })),
      effectivePrice: saleActive ? p.salePrice : p.basePrice,
      saleActive,
    };
  }
}
