import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationDto, paginate } from '../common/pagination.dto';

/** Допустимые ручные переходы статусов из админки */
const ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  PENDING_PAYMENT: ['CANCELLED'],
  PAYMENT_FAILED: ['CANCELLED'],
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async list(dto: PaginationDto & { status?: string; q?: string }) {
    const where: Prisma.OrderWhereInput = {
      ...(dto.status ? { status: dto.status as OrderStatus } : {}),
      ...(dto.q
        ? {
            OR: [
              { number: { contains: dto.q, mode: 'insensitive' } },
              { email: { contains: dto.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: {
          items: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        deliveryMethod: true,
        promoCode: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return order;
  }

  async changeStatus(id: string, to: OrderStatus, comment?: string) {
    const order = await this.getById(id);
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Переход ${order.status} → ${to} недопустим. Доступно: ${allowed.join(', ') || 'ничего'}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Отмена неоплаченного заказа = снять резерв
      if (to === 'CANCELLED' && order.status === 'PENDING_PAYMENT') {
        for (const item of order.items) {
          if (item.variantId) {
            await this.inventory.release(tx, item.variantId, item.quantity, order.id, 'Отмена администратором');
          }
        }
      }
      // Возврат после оплаты = вернуть товар на склад
      if (to === 'RETURNED') {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.$executeRaw`
              UPDATE product_variants
                 SET "stockQuantity" = "stockQuantity" + ${item.quantity}, "updatedAt" = NOW()
               WHERE id = ${item.variantId}
            `;
            await tx.stockMovement.create({
              data: { variantId: item.variantId, type: 'RESTOCK', quantity: item.quantity, orderId: order.id, comment: 'Возврат' },
            });
          }
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: { status: to, ...(to === 'CANCELLED' ? { reservationExpiresAt: null } : {}) },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, from: order.status, to, comment },
      });
      return updated;
    });
  }
}
