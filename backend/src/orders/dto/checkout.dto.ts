import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckoutDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  /** Snapshot адреса строкой (для гостя); авторизованный может передать addressId */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shippingAddress?: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsUUID()
  deliveryMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;

  /**
   * Ключ идемпотентности от клиента: повторная отправка формы с тем же
   * ключом вернёт уже созданный заказ, а не создаст дубль.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}
