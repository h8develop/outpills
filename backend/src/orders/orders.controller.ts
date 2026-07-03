import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsEmail } from 'class-validator';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { PaginationDto } from '../common/pagination.dto';

class RetryPaymentDto {
  @IsEmail()
  email!: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Checkout. Жёсткий rate limit: 5 попыток в минуту с клиента —
   * защита от флуда заказами и перебора промокодов.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('checkout')
  checkout(@Req() req: Request, @Body() dto: CheckoutDto) {
    const cartToken = (req as any).cookies?.cart_token;
    const userId = this.tryUserId(req);
    return this.orders.checkout(cartToken, dto, userId);
  }

  /** Заказ гостя: номер + email (без email заказ не отдаём) */
  @Get(':number')
  findByNumber(@Param('number') number: string, @Query('email') email?: string) {
    return this.orders.findByNumber(number, email || '__guest_requires_email__');
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':number/retry-payment')
  retryPayment(@Param('number') number: string, @Body() dto: RetryPaymentDto) {
    return this.orders.retryPayment(number, dto.email);
  }

  @UseGuards(AuthGuard)
  @Get()
  myOrders(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    return this.orders.findUserOrders(user.sub, dto);
  }

  private tryUserId(req: Request): string | undefined {
    return (req as any).user?.sub;
  }
}
