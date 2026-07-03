import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CartService } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { PaginationDto, paginate } from '../common/pagination.dto';

/**
 * Checkout и жизненный цикл заказа.
 *
 * Создание заказа (см. checkout()):
 *  1. корзина перечитывается из БД — количеству и ценам с frontend не верим;
 *  2. цены пересчитываются на backend (актуальная цена/скидка из БД);
 *  3. открывается транзакция:
 *     - каждый товар резервируется атомарным условным UPDATE
 *       (InventoryService.reserve). Если хоть одного не хватает —
 *       транзакция откатывается, пользователь получает список
 *       недоступных позиций;
 *     - создаётся Order (PENDING_PAYMENT) + OrderItem-snapshot-ы;
 *  4. после транзакции создаётся платёж (PaymentService);
 *  5. если оплата не завершена за RESERVATION_TTL_MINUTES — cron-воркер
 *     переводит заказ в EXPIRED и снимает резерв.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly cart: CartService,
    private readonly payments: PaymentsService,
  ) {}

  async checkout(cartToken: string | undefined, dto: CheckoutDto, userId?: string) {
    // Идемпотентность: тот же ключ → тот же заказ, без дублей
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (existing) {
        return {
          order: { id: existing.id, number: existing.number, status: existing.status, total: existing.total },
          payment: existing.payments[0] ?? null,
          duplicate: true,
        };
      }
    }

    // 1. Корзина: только из БД
    const cartView = await this.cart.getView(cartToken, userId);
    if (cartView.items.length === 0) {
      throw new BadRequestException('Корзина пуста');
    }

    // 2. Доставка и промокод валидируются по БД
    let deliveryPrice = 0;
    if (dto.deliveryMethodId) {
      const method = await this.prisma.deliveryMethod.findFirst({
        where: { id: dto.deliveryMethodId, isActive: true },
      });
      if (!method) throw new BadRequestException('Способ доставки недоступен');
      deliveryPrice = method.price;
    }

    let discount = 0;
    let promoCodeId: string | null = null;
    if (dto.promoCode) {
      const promo = await this.prisma.promoCode.findFirst({
        where: {
          code: dto.promoCode,
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
        },
      });
      if (!promo) throw new BadRequestException('Промокод недействителен');
      if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
        throw new BadRequestException('Промокод исчерпан');
      }
      promoCodeId = promo.id;
      discount = promo.discountFixed ?? Math.floor((cartView.subtotal * (promo.discountPercent ?? 0)) / 100);
    }

    const subtotal = cartView.subtotal; // пересчитан в CartService из цен БД
    const total = Math.max(0, subtotal - discount) + deliveryPrice;
    const ttlMinutes = Number(process.env.RESERVATION_TTL_MINUTES || 30);

    // 3. Транзакция: атомарный резерв + создание заказа
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: this.generateOrderNumber(),
          status: 'PENDING_PAYMENT',
          userId: userId ?? null,
          email: dto.email,
          phone: dto.phone,
          customerName: dto.customerName,
          addressId: dto.addressId ?? null,
          shippingAddress: dto.shippingAddress,
          deliveryMethodId: dto.deliveryMethodId ?? null,
          deliveryPrice,
          promoCodeId,
          subtotal,
          discount,
          total,
          idempotencyKey: dto.idempotencyKey ?? null,
          reservationExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });

      const unavailable: Array<{ name: string; size: string; color: string; available: number }> = [];

      for (const item of cartView.items) {
        const ok = await this.inventory.reserve(tx, item.variantId, item.quantity, created.id);
        if (!ok) {
          // Читаем фактический остаток для человеческого сообщения об ошибке
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          unavailable.push({
            name: item.name,
            size: item.size,
            color: item.color,
            available: v ? Math.max(0, v.stockQuantity - v.reservedQuantity) : 0,
          });
        }
      }

      if (unavailable.length > 0) {
        // Бросаем внутри транзакции → полный откат, резервы не повисают
        throw new ConflictException({
          message: 'Часть товаров закончилась или недоступна в нужном количестве',
          details: { unavailable },
        });
      }

      // Snapshot позиций — заказ не сломается при изменении товара
      for (const item of cartView.items) {
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            variantId: item.variantId,
            productId: item.productId,
            productName: item.name,
            sku: item.sku,
            size: item.size,
            color: item.color,
            price: item.price,
            quantity: item.quantity,
            imageKey: item.image,
          },
        });
      }

      if (promoCodeId) {
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usedCount: { increment: 1 } },
        });
      }

      await tx.orderStatusHistory.create({
        data: { orderId: created.id, to: 'PENDING_PAYMENT', comment: 'Заказ создан, товары зарезервированы' },
      });

      return created;
    });

    // 4. Платёж — вне складской транзакции. Если провайдер недоступен,
    // заказ остаётся PENDING_PAYMENT: пользователь может повторить оплату,
    // а по истечении TTL резерв снимется автоматически.
    let payment = null;
    try {
      payment = await this.payments.createForOrder(order.id);
    } catch (e) {
      this.logger.error(`Платёжный провайдер недоступен для заказа ${order.number}`, (e as Error).stack);
    }

    // Очищаем корзину после успешного создания заказа
    await this.cart.clear(cartToken, userId);

    return {
      order: { id: order.id, number: order.number, status: order.status, total: order.total },
      payment: payment
        ? { id: payment.id, status: payment.status, confirmationUrl: payment.confirmationUrl }
        : { error: 'Платёжный сервис временно недоступен — попробуйте оплатить позже из заказа' },
    };
  }

  async findByNumber(number: string, email?: string) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        deliveryMethod: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    // Гость видит заказ только по паре номер+email
    if (email && order.email.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Заказ не найден');
    }
    return order;
  }

  async findUserOrders(userId: string, dto: PaginationDto) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  /** Повторное создание платежа (кнопка «оплатить» из заказа) */
  async retryPayment(orderNumber: string, email: string) {
    const order = await this.findByNumber(orderNumber, email);
    return this.payments.createForOrder(order.id);
  }

  /** Человекочитаемый номер: OP-<base36-время><случайный хвост> */
  private generateOrderNumber(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `OP-${time}${rand}`;
  }
}
