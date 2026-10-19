import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductCategory {
    COFFEE = 'coffee',
    TEA = 'tea',
    SPECIAL = 'special',
    BAKERY = 'bakery',
}
export class ProductResponseDto {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    stock: number;
    description?: string;
    category: ProductCategory;
    isPopular?: boolean;
    createdAt?: string;
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
    @IsNumber({}, { message: 'Gia toi thieu phai la so' })
    @Min(0, { message: 'Gia toi thieu khong duoc am' })
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Gia toi da phai la so' })
    @Min(0, { message: 'Gia toi da khong duoc am' })
    maxPrice?: number;

}