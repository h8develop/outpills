import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class ListProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  category?: string; // slug категории

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'UNISEX', 'KIDS'])
  gender?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  q?: string; // поиск по названию / SKU

  @IsOptional()
  @IsIn(['new', 'price_asc', 'price_desc'])
  sort?: string = 'new';

  @IsOptional()
  @IsIn(['1', 'true'])
  inStock?: string; // только в наличии
}
