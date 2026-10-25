import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ToppingItemDto {
  @IsString({ message: 'Mã topping (toppingId) phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã topping (toppingId) không được để trống' })
  toppingId: string;

  @IsOptional()
  @Allow()
  name?: unknown;

  @IsOptional()
  @Allow()
  price?: unknown;
}

export class OrderItemDto {
  @IsString({ message: 'Mã món (productId) phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã món (productId) không được để trống' })
  productId: string;

  @IsString()
  @IsEnum(['S', 'M', 'L', 'STANDARD'], {
    message: 'Kích thước (size) phải là một trong các giá trị: S, M, L, STANDARD',
  })
  size: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số lượng (qty) phải là một số nguyên dương' })
  qty: number;

  @IsOptional()
  @Allow()
  basePrice?: unknown;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToppingItemDto)
  toppings?: ToppingItemDto[];
}

export class CreateOrderDto {
  @IsArray({ message: 'Danh sách món (items) phải là một mảng' })
  @ArrayMinSize(1, { message: 'Danh sách món (items) phải có ít nhất 1 món' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString({ message: 'Mã voucher (voucherId) phải là chuỗi' })
  voucherId?: string;

  @IsOptional()
  @IsString({ message: 'Mã voucher (voucherCode) phải là chuỗi' })
  voucherCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số điểm sử dụng (pointsUsed) phải là một số nguyên' })
  @Min(0, { message: 'Số điểm sử dụng (pointsUsed) phải là một số nguyên không âm' })
  pointsUsed = 0;

  @IsOptional()
  @IsString({ message: 'Ghi chú (note) phải là chuỗi' })
  note?: string;
}
