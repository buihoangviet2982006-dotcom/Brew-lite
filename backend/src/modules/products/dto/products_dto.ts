import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductCategory {
  COFFEE = 'coffee',
  TEA = 'tea',
  SPECIAL = 'special',
  BAKERY = 'bakery',
}

export interface ProductSizeItem {
  size: string; // 'S', 'M', 'L'
  price: number;
}

export interface ToppingDto {
  id: string;
  name: string;
  price: number;
}

export class ProductResponseDto {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  description?: string;
  category: ProductCategory;
  sizes: ProductSizeItem[];
  isAvailable: boolean;
  createdAt?: string;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  availableToppings: ToppingDto[];
}

export class GetProductsQueryDto {
  @IsOptional()
  @IsEnum(ProductCategory, { message: 'Danh mục phải là coffee, tea, special hoặc bakery' })
  category?: ProductCategory;

  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tối thiểu phải là số' })
  @Min(0, { message: 'Giá tối thiểu không được âm' })
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tối đa phải là số' })
  @Min(0, { message: 'Giá tối đa không được âm' })
  maxPrice?: number;
}