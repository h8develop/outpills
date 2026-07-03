import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * Корзина: гостевая (по token в httpOnly-cookie) или пользовательская.
 * Backend НЕ доверяет количеству с frontend: при каждом изменении
 * проверяет доступный остаток (stock - reserved). Финальная правда —
 * всё равно на checkout (атомарный резерв), здесь — ранняя валидация UX.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getOrCreate(token?: string, userId?: string) {
    let cart = null;
    if (token) {
      cart = await this.prisma.cart.findUnique({ where: { token } });
    }
    if (!cart && userId) {
      cart = await this.prisma.cart.findFirst({ where: { userId } });
    }
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId: userId ?? null } });
    } else if (userId && !cart.userId) {
      // Привязываем гостевую корзину к юзеру после логина
      cart = await this.prisma.cart.update({ where: { id: cart.id }, data: { userId } });
    }
    return cart;
  }

  async getView(token?: string, userId?: string) {
    const cart = await this.getOrCreate(token, userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const viewItems = items.map((item) => {
      const p = item.variant.product;
      const saleActive =
        p.salePrice != null &&
        (!p.saleStartsAt || p.saleStartsAt <= now) &&
        (!p.saleEndsAt || p.saleEndsAt >= now);
      const price = saleActive ? p.salePrice! : p.basePrice;
      const available = Math.max(0, item.variant.stockQuantity - item.variant.reservedQuantity);
      return {
        id: item.id,
        variantId: item.variantId,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        sku: item.variant.sku,
        size: item.variant.size,
        color: item.variant.color,
        price,
        quantity: item.quantity,
        lineTotal: price * item.quantity,
        available,
        // товар мог закончиться, пока лежал в корзине — фронт покажет предупреждение
        stockIssue: item.variant.status !== 'ACTIVE' || available < item.quantity,
        image: p.images[0] ? this.storage.publicUrl(p.images[0].objectKey) : null,
      };
    });

    return {
      token: cart.token,
      items: viewItems,
      subtotal: viewItems.reduce((sum, i) => sum + i.lineTotal, 0),
      hasStockIssues: viewItems.some((i) => i.stockIssue),
    };
  }

  async addItem(token: string | undefined, userId: string | undefined, variantId: string, quantity: number) {
    const cart = await this.getOrCreate(token, userId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true } } },
    });
    if (!variant || variant.product.status !== 'PUBLISHED' || variant.status === 'HIDDEN') {
      throw new NotFoundException('Товар недоступен');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const desired = (existing?.quantity ?? 0) + quantity;

    const available = variant.stockQuantity - variant.reservedQuantity;
    if (desired > available) {
      throw new BadRequestException({
        message: `Недостаточно товара: доступно ${Math.max(0, available)} шт.`,
        details: { variantId, available: Math.max(0, available), requested: desired },
      });
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity },
      update: { quantity: desired },
    });
    return this.getView(cart.token, userId);
  }

  async updateQuantity(token: string | undefined, userId: string | undefined, itemId: string, quantity: number) {
    const cart = await this.getOrCreate(token, userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { variant: true },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const available = item.variant.stockQuantity - item.variant.reservedQuantity;
      if (quantity > available) {
        throw new BadRequestException({
          message: `Недостаточно товара: доступно ${Math.max(0, available)} шт.`,
          details: { variantId: item.variantId, available: Math.max(0, available), requested: quantity },
        });
      }
      await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }
    return this.getView(cart.token, userId);
  }

  async removeItem(token: string | undefined, userId: string | undefined, itemId: string) {
    const cart = await this.getOrCreate(token, userId);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.getView(cart.token, userId);
  }

  async clear(token: string | undefined, userId: string | undefined) {
    const cart = await this.getOrCreate(token, userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getView(cart.token, userId);
  }
}
