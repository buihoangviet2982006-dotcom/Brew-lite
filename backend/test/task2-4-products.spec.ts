import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsController } from '../src/modules/products/products_controller';
import { ProductsService } from '../src/modules/products/products_service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductCategory } from '../src/modules/products/dto/products_dto';

describe('Task 2, 3, 4: Products Menu & Product Detail with Size/Topping Options', () => {
  let controller: ProductsController;
  let prisma: PrismaService;

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    topping: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Task 2: GET /products trả về danh sách menu đồ uống kèm id, tên, giá, ảnh, sizes', async () => {
    mockPrismaService.product.findMany.mockResolvedValue([
      {
        id: 'prod-cf-01',
        name: 'Cà phê sữa đá Sài Gòn',
        price: new Prisma.Decimal(35000),
        imageUrl: 'https://example.com/cf-sua.jpg',
        description: 'Cà phê đậm đà',
        category: 'coffee',
        sizes: [
          { size: 'S', price: 35000 },
          { size: 'M', price: 40000 },
          { size: 'L', price: 45000 },
        ],
        isAvailable: true,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]);

    const result = await controller.getProducts({});

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'prod-cf-01',
      name: 'Cà phê sữa đá Sài Gòn',
      price: 35000,
      imageUrl: 'https://example.com/cf-sua.jpg',
      category: 'coffee',
      sizes: [
        { size: 'S', price: 35000 },
        { size: 'M', price: 40000 },
        { size: 'L', price: 45000 },
      ],
    });
  });

  it('2. Task 2: GET /products hỗ trợ lọc theo category, từ khóa tìm kiếm và khoảng giá', async () => {
    mockPrismaService.product.findMany.mockResolvedValue([]);

    await controller.getProducts({
      category: ProductCategory.TEA,
      search: 'đào',
      minPrice: 20000,
      maxPrice: 50000,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        category: ProductCategory.TEA,
        OR: [
          { name: { contains: 'đào', mode: 'insensitive' } },
          { description: { contains: 'đào', mode: 'insensitive' } },
        ],
        price: { gte: 20000, lte: 50000 },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('3. Task 4: GET /products/:id trả về chi tiết sản phẩm đồ uống kèm sizes (S/M/L) và danh sách availableToppings', async () => {
    mockPrismaService.product.findUnique.mockResolvedValue({
      id: 'prod-tea-01',
      name: 'Trà đào cam sả',
      price: new Prisma.Decimal(39000),
      imageUrl: 'https://example.com/tra-dao.jpg',
      category: 'tea',
      sizes: null, // Tự động suy ra S (+0), M (+5000), L (+10000)
      isAvailable: true,
    });

    mockPrismaService.topping.findMany.mockResolvedValue([
      { id: 'top-pearl', name: 'Trân châu đen', price: new Prisma.Decimal(5000), isActive: true },
      { id: 'top-cheese', name: 'Kem Cheese', price: new Prisma.Decimal(8000), isActive: true },
    ]);

    const detail = await controller.getProductById('prod-tea-01');

    expect(detail.id).toBe('prod-tea-01');
    expect(detail.sizes).toEqual([
      { size: 'S', price: 39000 },
      { size: 'M', price: 44000 },
      { size: 'L', price: 49000 },
    ]);
    expect(detail.availableToppings).toEqual([
      { id: 'top-pearl', name: 'Trân châu đen', price: 5000 },
      { id: 'top-cheese', name: 'Kem Cheese', price: 8000 },
    ]);
  });

  it('4. Task 4: GET /products/:id ném NotFoundException khi mã sản phẩm không tồn tại', async () => {
    mockPrismaService.product.findUnique.mockResolvedValue(null);

    await expect(controller.getProductById('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

