import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetProductsQueryDto, ProductCategory, ProductResponseDto } from './dto/products_dto';

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

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với mã '${id}'.`);
    }

    return this.mapToDto(product);
  }

  private mapToDto(product: any): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      stock: product.stock,
      description: product.description ?? undefined,
      category: (product.category as ProductCategory) || ProductCategory.COFFEE,
      isPopular: product.isPopular ?? false,
      createdAt: product.createdAt?.toISOString(),
    };
  }
}