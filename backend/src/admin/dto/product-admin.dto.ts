import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

/**
 * DTO формы создания/редактирования товара в админке.
 * Структура повторяет блоки карточки: основная информация, цена,
 * варианты (размер × цвет × остаток), изображения, SEO, габариты.
 */

export class VariantInputDto {
  @IsOptional()
  @IsUUID()
  id?: string; // есть id — обновляем, нет — создаём

  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MaxLength(64)
  color!: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  colorHex?: string;

  @IsString()
  @MaxLength(16)
  size!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN'])
  status?: string;
}

export class ImageInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpsertProductDto {
  // ── Основная информация ──
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string; // не передан — сгенерируется из названия

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'UNISEX', 'KIDS'])
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  collection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'])
  status?: string;

  // ── Цена (копейки) ──
  @IsInt()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;

  // ── SEO ──
  @IsOptional()
  @IsString()
  @MaxLength(120)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  // ── Доставка и состав ──
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  material?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  careNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  countryOfOrigin?: string;

  // ── Варианты и изображения ──
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants?: VariantInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  images?: ImageInputDto[];
}

export class AdminListProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsString()
  q?: string; // поиск: название или SKU

  @IsOptional()
  @IsIn(['1', 'true'])
  lowStock?: string; // фильтр «мало на складе»
}
