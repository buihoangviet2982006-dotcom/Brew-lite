import { Injectable, NotFoundException } from "@nestjs/common";
import { GetProductsQueryDto, ProductCategory, ProductResponseDto } from "./dto/products_dto";

@Injectable()
export class ProductsService {
   private products:  ProductResponseDto[] = [
     {
       id: 'prod-cf-01',
       name: 'Cà phê sữa đá Sài Gòn',
       price: 29000,
       imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
       stock: 45,
       description: 'Hương vị cà phê Robusta Đắk Lắk đậm đà kết hợp sữa đặc béo ngậy truyền thống.',
      category: ProductCategory.COFFEE,
      isPopular: true,
      createdAt: new Date().toISOString(),
        },

        {
         id: 'prod-cf-02',
         name: 'Bạc xỉu 3 tầng BrewLite',
         price: 32000,
         imageUrl: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
         stock: 38,
         description: 'Nhiều sữa ít cà phê, béo ngậy thơm lừng hòa quyện sữa tươi thanh trùng.',
         category: ProductCategory.COFFEE,
         isPopular: true,
         createdAt: new Date().toISOString(),
        },
        {
         id: 'prod-cf-03',
         name: 'Cà phê muối xứ Huế',
         price: 35000,
         imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
         stock: 25,
         description: 'Sự kết hợp độc đáo giữa vị đậm đà của cà phê phin và lớp kem béo mặn sánh mịn.',
         category: ProductCategory.SPECIAL,
         isPopular: true,
         createdAt: new Date().toISOString(),
        },
        {
         id: 'prod-tea-01',
         name: 'Trà đào cam sả thanh nhiệt',
         price: 38000,
         imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
         stock: 40,
         description: 'Vị trà lài tươi mát cùng đào ngâm giòn sần sật và lát cam vàng tươi.',
         category: ProductCategory.TEA,
         isPopular: true,
         createdAt: new Date().toISOString(),
        },
   ]
   async findAll(query?: GetProductsQueryDto): Promise<ProductResponseDto[]> {
    let result = [...this.products];
    if (!query) return result;

    if (query.category) {
      result = result.filter(p => p.category === query.category);
    }
    if (query.search && query.search.trim() !== '') {
      const kw = query.search.toLowerCase().trim();
      result = result.filter(
        p => p.name.toLowerCase().includes(kw) || (p.description && p.description.toLowerCase().includes(kw)),
      );
    }
    if (query.minPrice !== undefined) {
      result = result.filter(p => p.price >= query.minPrice!);
    }
    if (query.maxPrice !== undefined) {
      result = result.filter(p => p.price <= query.maxPrice!);
    }
    return result;
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = this.products.find(p => p.id === id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với mã '${id}'.`);
    }
    return product;
  }
}