import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminGuard } from '../auth/admin.guard';
import { AdminProductsService } from './admin-products.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminListProductsDto, UpsertProductDto } from './dto/product-admin.dto';
import { PaginationDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CategoriesService } from '../categories/categories.service';
import { OrderStatus } from '@prisma/client';

class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  comment?: string;
}

class ChangeOrderStatusDto {
  @IsIn(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}

class UploadUrlDto {
  @IsString()
  contentType!: string;

  @IsIn(['jpg', 'jpeg', 'png', 'webp', 'avif'])
  ext!: string;
}

class AdminOrdersListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

class UpsertCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(140)
  slug!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class SettingDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsString()
  @MaxLength(2000)
  value!: string;
}

/**
 * Админ-API. Всё под AdminGuard (JWT + role=ADMIN).
 * Разделы: товары, категории, заказы, платежи, покупатели, настройки.
 */
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly orders: AdminOrdersService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly categories: CategoriesService,
  ) {}

  // ─── Товары ───
  @Get('products')
  listProducts(@Query() dto: AdminListProductsDto) {
    return this.products.list(dto);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.products.getById(id);
  }

  @Post('products')
  createProduct(@Body() dto: UpsertProductDto) {
    return this.products.create(dto);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto);
  }

  @Patch('products/:id/status')
  setProductStatus(
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED',
  ) {
    return this.products.setStatus(id, status);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.products.remove(id);
  }

  /** Остатки: изменение через журнал движений */
  @Post('variants/:id/adjust-stock')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.products.adjustStock(id, dto.delta, dto.comment);
  }

  /** Presigned URL для загрузки изображения напрямую в object storage */
  @Post('uploads/presign')
  presignUpload(@Body() dto: UploadUrlDto) {
    return this.storage.createUploadUrl(dto.contentType, dto.ext);
  }

  // ─── Категории ───
  @Post('categories')
  async createCategory(@Body() dto: UpsertCategoryDto) {
    const category = await this.prisma.category.create({ data: dto });
    await this.categories.invalidateCache();
    return category;
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    const category = await this.prisma.category.update({ where: { id }, data: dto });
    await this.categories.invalidateCache();
    return category;
  }

  // ─── Заказы ───
  @Get('orders')
  listOrders(@Query() dto: AdminOrdersListDto) {
    return this.orders.list(dto);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Patch('orders/:id/status')
  changeOrderStatus(@Param('id') id: string, @Body() dto: ChangeOrderStatusDto) {
    return this.orders.changeStatus(id, dto.status as OrderStatus, dto.comment);
  }

  // ─── Платежи ───
  @Get('payments')
  async listPayments(@Query() dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: { order: { select: { number: true, email: true } } },
      }),
      this.prisma.payment.count(),
    ]);
    return { items, total, page: dto.page, limit: dto.limit };
  }

  // ─── Покупатели ───
  @Get('customers')
  async listCustomers(@Query() dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
    ]);
    return { items, total, page: dto.page, limit: dto.limit };
  }

  // ─── Настройки магазина ───
  @Get('settings')
  getSettings() {
    return this.prisma.storeSetting.findMany();
  }

  @Put('settings')
  setSetting(@Body() dto: SettingDto) {
    return this.prisma.storeSetting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value: dto.value },
      update: { value: dto.value },
    });
  }
}
