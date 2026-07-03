import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Пагинация обязательна во всех списках (каталог, заказы, админка) —
 * ограничение размера выборки защищает БД от тяжёлых запросов.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // жёсткий потолок размера страницы
  limit: number = 24;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, dto: PaginationDto): Paginated<T> {
  return {
    items,
    total,
    page: dto.page,
    limit: dto.limit,
    totalPages: Math.ceil(total / dto.limit) || 1,
  };
}
