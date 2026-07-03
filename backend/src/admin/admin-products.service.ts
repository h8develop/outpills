import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { AdminListProductsDto, UpsertProductDto } from './dto/product-admin.dto';
import { paginate } from '../common/pagination.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
  ) {}

  async list(dto: AdminListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      ...(dto.status ? { status: dto.status as any } : {}),
      ...(dto.category ? { category: { slug: dto.category } } : {}),
      ...(dto.q
        ? {
            OR: [
              { name: { contains: dto.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: dto.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: {
          category: { select: { name: true, slug: true } },
          variants: {
            select: { id: true, sku: true, size: true, color: true, stockQuantity: true, reservedQuantity: true, status: true },
          },
          images: { orderBy: [{ isPrimary: 'desc' }], take: 1 },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    let mapped = items.map((p) => ({
      ...p,
      totalAvailable: p.variants.reduce(
        (sum, v) => sum + Math.max(0, v.stockQuantity - v.reservedQuantity),
        0,
      ),
    }));
    if (dto.lowStock) mapped = mapped.filter((p) => p.totalAvailable <= 3);

    return paginate(mapped, total, dto);
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        category: true,
      },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    return product;
  }

  async create(dto: UpsertProductDto) {
    const slug = dto.slug || this.slugify(dto.name);
    await this.assertSlugFree(slug);

    const product = await this.prisma.product.create({
      data: {
        ...this.productData(dto),
        slug,
        variants: dto.variants
          ? {
              create: dto.variants.map((v) => ({
                sku: v.sku,
                color: v.color,
                colorHex: v.colorHex,
                size: v.size,
                barcode: v.barcode,
                stockQuantity: v.stockQuantity,
                status: (v.status as any) ?? 'ACTIVE',
              })),
            }
          : undefined,
        images: dto.images
          ? {
              create: dto.images.map((img, i) => ({
                objectKey: img.objectKey,
                alt: img.alt,
                isPrimary: img.isPrimary ?? i === 0,
                sortOrder: img.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: { variants: true, images: true },
    });

    await this.products.invalidateCache();
    return product;
  }

  async update(id: string, dto: UpsertProductDto) {
    await this.getById(id);
    const slug = dto.slug || undefined;
    if (slug) await this.assertSlugFree(slug, id);

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { ...this.productData(dto), ...(slug ? { slug } : {}) },
      });

      if (dto.variants) {
        const keepIds = dto.variants.filter((v) => v.id).map((v) => v.id!);
        // Удаляем варианты, которых больше нет в форме (без движений склада)
        await tx.productVariant.deleteMany({
          where: { productId: id, id: { notIn: keepIds }, orderItems: { none: {} } },
        });
        for (const v of dto.variants) {
          if (v.id) {
            // ВАЖНО: остатки здесь не трогаем — для этого отдельный
            // endpoint adjust-stock с журналом движений
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                sku: v.sku,
                color: v.color,
                colorHex: v.colorHex,
                size: v.size,
                barcode: v.barcode,
                status: (v.status as any) ?? undefined,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                sku: v.sku,
                color: v.color,
                colorHex: v.colorHex,
                size: v.size,
                barcode: v.barcode,
                stockQuantity: v.stockQuantity,
                status: (v.status as any) ?? 'ACTIVE',
              },
            });
          }
        }
      }

      if (dto.images) {
        const keepIds = dto.images.filter((i) => i.id).map((i) => i.id!);
        await tx.productImage.deleteMany({ where: { productId: id, id: { notIn: keepIds } } });
        for (const [i, img] of dto.images.entries()) {
          if (img.id) {
            await tx.productImage.update({
              where: { id: img.id },
              data: { alt: img.alt, isPrimary: img.isPrimary ?? false, sortOrder: img.sortOrder ?? i },
            });
          } else {
            await tx.productImage.create({
              data: {
                productId: id,
                objectKey: img.objectKey,
                alt: img.alt,
                isPrimary: img.isPrimary ?? false,
                sortOrder: img.sortOrder ?? i,
              },
            });
          }
        }
      }

      return updated;
    });

    await this.products.invalidateCache();
    return this.getById(product.id);
  }

  /** Смена статуса: публикация / скрытие / архив */
  async setStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') {
    await this.getById(id);
    const product = await this.prisma.product.update({ where: { id }, data: { status } });
    await this.products.invalidateCache();
    return product;
  }

  /** Корректировка остатков варианта (+ журнал движений) */
  async adjustStock(variantId: string, delta: number, comment?: string) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('delta должна быть ненулевым целым');
    }
    await this.inventory.adjust(variantId, delta, comment);
    await this.products.invalidateCache();
    return this.prisma.productVariant.findUnique({ where: { id: variantId } });
  }

  async remove(id: string) {
    const orders = await this.prisma.orderItem.count({ where: { productId: id } });
    if (orders > 0) {
      // История заказов важнее — товар с продажами только архивируем
      return this.setStatus(id, 'ARCHIVED');
    }
    await this.prisma.product.delete({ where: { id } });
    await this.products.invalidateCache();
    return { deleted: true };
  }

  private productData(dto: UpsertProductDto) {
    return {
      name: dto.name,
      categoryId: dto.categoryId,
      brand: dto.brand ?? undefined,
      gender: (dto.gender as any) ?? undefined,
      collection: dto.collection,
      shortDescription: dto.shortDescription,
      description: dto.description,
      status: (dto.status as any) ?? undefined,
      basePrice: dto.basePrice,
      salePrice: dto.salePrice ?? null,
      saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null,
      saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null,
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      weightGrams: dto.weightGrams,
      material: dto.material,
      careNotes: dto.careNotes,
      countryOfOrigin: dto.countryOfOrigin,
    };
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const exists = await this.prisma.product.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (exists) throw new BadRequestException(`Slug «${slug}» уже занят`);
  }

  /** Транслитерация RU → slug: «Худи Протокол» → hudi-protokol */
  private slugify(name: string): string {
    const map: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
      и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
      с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
      щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    return name
      .toLowerCase()
      .split('')
      .map((ch) => map[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }
}
