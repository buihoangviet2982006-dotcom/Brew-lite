import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetProductsQueryDto,
  ProductCategory,
  ProductDetailResponseDto,
  ProductResponseDto,
  ProductSizeItem,
  ToppingDto,
} from './dto/products_dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: GetProductsQueryDto): Promise<ProductResponseDto[]> {
    const where: Prisma.ProductWhereInput = {};

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.search && query.search.trim() !== '') {
      const kw = query.search.trim();
      where.OR = [
        { name: { contains: kw, mode: 'insensitive' } },
        { description: { contains: kw, mode: 'insensitive' } },
      ];
    }

    if (query?.minPrice !== undefined || query?.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => this.mapToDto(product));
  }

  async findOne(id: string): Promise<ProductDetailResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với mã '${id}'.`);
    }

    const baseDto = this.mapToDto(product);

    // Món thức uống (coffee, tea, special) có toppings, bakery không có toppings
    let availableToppings: ToppingDto[] = [];
    if (product.category !== ProductCategory.BAKERY) {
      const toppings = await this.prisma.topping.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });
      availableToppings = toppings.map((t) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price),
      }));
    }

    return {
      ...baseDto,
      availableToppings,
    };
  }

  private mapToDto(product: any): ProductResponseDto {
    let sizes: ProductSizeItem[] = [];

    if (Array.isArray(product.sizes)) {
      sizes = (product.sizes as any[]).map((item) => ({
        size: String(item.size || 'STANDARD'),
        price: Number(item.price ?? product.price),
      }));
    } else if (product.category !== ProductCategory.BAKERY) {
      // Mặc định nếu chưa set sizes riêng cho đồ uống
      const basePrice = Number(product.price);
      sizes = [
        { size: 'S', price: basePrice },
        { size: 'M', price: basePrice + 5000 },
        { size: 'L', price: basePrice + 10000 },
      ];
    }

    return {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      stock: product.stock,
      description: product.description ?? undefined,
      category: (product.category as ProductCategory) || ProductCategory.COFFEE,
      sizes,
      isAvailable: product.isAvailable ?? true,
      createdAt: product.createdAt?.toISOString(),
    };
  }
}