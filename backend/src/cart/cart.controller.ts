import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { CartService } from './cart.service';

class AddItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(20) // разумный потолок на одну позицию
  quantity!: number;
}

class UpdateQuantityDto {
  @IsInt()
  @Min(0)
  @Max(20)
  quantity!: number;
}

const CART_COOKIE = 'cart_token';

function cartCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  private token(req: Request): string | undefined {
    return (req as any).cookies?.[CART_COOKIE];
  }

  private setToken(res: Response, token: string) {
    res.cookie(CART_COOKIE, token, cartCookieOptions());
  }

  @Get()
  async get(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const view = await this.cart.getView(this.token(req));
    this.setToken(res, view.token);
    return view;
  }

  @Post('items')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddItemDto,
  ) {
    const view = await this.cart.addItem(this.token(req), undefined, dto.variantId, dto.quantity);
    this.setToken(res, view.token);
    return view;
  }

  @Patch('items/:id')
  updateQuantity(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateQuantityDto) {
    return this.cart.updateQuantity(this.token(req), undefined, id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Req() req: Request, @Param('id') id: string) {
    return this.cart.removeItem(this.token(req), undefined, id);
  }

  @Delete()
  clear(@Req() req: Request) {
    return this.cart.clear(this.token(req), undefined);
  }
}
