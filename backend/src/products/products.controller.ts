import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ListProductsDto } from './dto/list-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() dto: ListProductsDto) {
    return this.products.findAll(dto);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @Get(':slug/similar')
  findSimilar(@Param('slug') slug: string) {
    return this.products.findSimilar(slug);
  }
}
