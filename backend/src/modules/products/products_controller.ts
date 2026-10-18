import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ProductsService } from './products_service';
import { GetProductsQueryDto, ProductResponseDto } from './dto/products_dto';

@Controller('products')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(@Query() query: GetProductsQueryDto): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  async getProductById(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }
}