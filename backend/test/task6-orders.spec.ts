import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersController } from '../src/modules/orders/orders_controller';
import { OrdersService } from '../src/modules/orders/orders_service';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { CreateOrderDto } from '../src/modules/orders/dto/create_order_dto';

describe('Task 6: Create Order API (POST /orders with Validation & Recipe Ingredient Check)', () => {
  let controller: OrdersController;
  let inventoryService: InventoryService;

  const mockTx = {
    user: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    topping: {
      findMany: jest.fn(),
    },
    recipe: {
      findFirst: jest.fn(),
    },
    ingredient: {
      findMany: jest.fn(),
    },
    voucher: {
      findFirst: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Validate dữ liệu đầu vào bằng ValidationPipe (chặn giỏ hàng rỗng hoặc số lượng < 1)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        { items: [] },
        { type: 'body', metatype: CreateOrderDto },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      pipe.transform(
        { items: [{ productId: 'prod-1', size: 'M', qty: 0 }] },
        { type: 'body', metatype: CreateOrderDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('2. POST /orders tính đúng giá (size + topping * qty), định lượng nguyên liệu từ công thức và lưu trạng thái PENDING', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      id: 'usr-1',
      loyaltyPoints: 200,
    });
    mockTx.product.findMany.mockResolvedValue([
      {
        id: 'prod-cf-01',
        name: 'Cà phê sữa đá',
        price: new Prisma.Decimal(30000),
        category: 'coffee',
        sizes: [
          { size: 'S', price: 30000 },
          { size: 'M', price: 35000 },
        ],
        isAvailable: true,
      },
    ]);
    mockTx.topping.findMany.mockResolvedValue([
      {
        id: 'top-pearl',
        name: 'Trân châu đen',
        price: new Prisma.Decimal(5000),
        isActive: true,
      },
    ]);

    // Recipe cho món size M (20g cà phê) và topping (40g trân châu)
    mockTx.recipe.findFirst
      .mockResolvedValueOnce({
        items: [
          {
            ingredientId: 'ing-coffee',
            quantity: new Prisma.Decimal(20),
            ingredient: { name: 'Hạt cà phê', isActive: true },
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            ingredientId: 'ing-pearl',
            quantity: new Prisma.Decimal(40),
            ingredient: { name: 'Trân châu đen', isActive: true },
          },
        ],
      });

    // Kho nguyên liệu đủ
    mockTx.ingredient.findMany.mockResolvedValue([
      {
        id: 'ing-coffee',
        name: 'Hạt cà phê',
        isActive: true,
        currentQuantity: new Prisma.Decimal(500),
      },
      {
        id: 'ing-pearl',
        name: 'Trân châu đen',
        isActive: true,
        currentQuantity: new Prisma.Decimal(500),
      },
    ]);

    mockTx.order.create.mockImplementation(async ({ data }) => ({
      id: 'ord-1001',
      orderNumber: data.orderNumber,
      status: data.status,
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      total: data.total,
      items: data.items.create,
      createdAt: new Date(),
    }));

    const res = await controller.createOrder(
      {
        items: [
          {
            productId: 'prod-cf-01',
            size: 'M',
            qty: 2,
            toppings: [{ toppingId: 'top-pearl' }],
          },
        ],
      },
      { id: 'usr-1' },
    );

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('PENDING');
    expect(res.data.orderNumber).toMatch(/^#\d{4}$/);
    // (35.000 + 5.000) * 2 = 80.000
    expect(res.data.subtotal).toBe(80000);
    expect(res.data.total).toBe(80000);
  });

  it('3. POST /orders từ chối tạo đơn khi nguyên liệu trong kho không đủ theo công thức', async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: 'usr-1', loyaltyPoints: 0 });
    mockTx.product.findMany.mockResolvedValue([
      {
        id: 'prod-cf-01',
        name: 'Cà phê sữa đá',
        price: new Prisma.Decimal(30000),
        category: 'coffee',
        sizes: [{ size: 'S', price: 30000 }],
        isAvailable: true,
      },
    ]);
    mockTx.recipe.findFirst.mockResolvedValueOnce({
      items: [
        {
          ingredientId: 'ing-coffee',
          quantity: new Prisma.Decimal(20),
          ingredient: { name: 'Hạt cà phê', isActive: true },
        },
      ],
    });
    mockTx.ingredient.findMany.mockResolvedValue([
      {
        id: 'ing-coffee',
        name: 'Hạt cà phê',
        isActive: true,
        currentQuantity: new Prisma.Decimal(10), // Không đủ 20g
      },
    ]);

    await expect(
      controller.createOrder(
        {
          items: [{ productId: 'prod-cf-01', size: 'S', qty: 1 }],
        },
        { id: 'usr-1' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

