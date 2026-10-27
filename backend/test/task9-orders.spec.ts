import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersController } from '../src/modules/orders/orders_controller';
import { OrdersService } from '../src/modules/orders/orders_service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('Task 9: Order Confirmation & History (OrdersController & OrdersService)', () => {
  let controller: OrdersController;
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Controller phải có phương thức getMyOrders và getOrderById', () => {
    expect(controller.getMyOrders).toBeDefined();
    expect(controller.getOrderById).toBeDefined();
    expect(typeof controller.getMyOrders).toBe('function');
    expect(typeof controller.getOrderById).toBe('function');
  });

  it('2. getMyOrders trả về danh sách lịch sử đơn hàng với format chuẩn (number, note, product info)', async () => {
    const mockDbOrders = [
      {
        id: 'order-1',
        orderNumber: '#1042',
        status: 'PAID',
        subtotal: new Prisma.Decimal(35000),
        discountAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(35000),
        note: '[Dùng tại quán] Khách: Nguyen Van A',
        createdAt: new Date('2026-10-27T10:00:00Z'),
        items: [
          {
            id: 'item-1',
            orderId: 'order-1',
            productId: 'prod-1',
            size: 'M',
            basePrice: new Prisma.Decimal(35000),
            qty: 1,
            lineTotal: new Prisma.Decimal(35000),
            toppings: null,
            product: {
              id: 'prod-1',
              name: 'Cà phê sữa đá',
              imageUrl: 'https://example.com/cf.png',
            },
          },
        ],
      },
    ];

    mockPrismaService.order.findMany.mockResolvedValue(mockDbOrders);

    const result = await controller.getMyOrders({ id: 'user-123' });

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);

    const order = result.data[0];
    expect(order.id).toBe('order-1');
    expect(order.orderNumber).toBe('#1042');
    expect(order.status).toBe('PAID');
    expect(order.subtotal).toBe(35000);
    expect(order.total).toBe(35000);
    expect(order.itemsCount).toBe(1);
    expect(order.note).toBe('[Dùng tại quán] Khách: Nguyen Van A');

    // Kiểm tra giá item được ép kiểu sang Number
    expect(typeof order.items[0].basePrice).toBe('number');
    expect(order.items[0].basePrice).toBe(35000);
    expect(typeof order.items[0].lineTotal).toBe('number');
    expect(order.items[0].lineTotal).toBe(35000);
    expect(order.items[0].product.name).toBe('Cà phê sữa đá');
  });

  it('3. getOrderById trả về chi tiết đơn hàng cho màn hình xác nhận đơn', async () => {
    const mockOrder = {
      id: 'order-1042',
      orderNumber: '#1042',
      status: 'PAID',
      subtotal: new Prisma.Decimal(45000),
      discountAmount: new Prisma.Decimal(5000),
      total: new Prisma.Decimal(40000),
      note: '[Mang đi]',
      createdAt: new Date('2026-10-27T10:00:00Z'),
      items: [
        {
          id: 'item-2',
          orderId: 'order-1042',
          productId: 'prod-2',
          size: 'L',
          basePrice: new Prisma.Decimal(45000),
          qty: 1,
          lineTotal: new Prisma.Decimal(45000),
          toppings: null,
          product: {
            id: 'prod-2',
            name: 'Trà đào cam sả',
            imageUrl: 'https://example.com/tradao.png',
          },
        },
      ],
    };

    mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

    const result = await controller.getOrderById('order-1042', { id: 'user-123' });

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'order-1042',
        userId: 'user-123',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.orderNumber).toBe('#1042');
    expect(result.data.status).toBe('PAID');
    expect(result.data.total).toBe(40000);
    expect(result.data.discountAmount).toBe(5000);
    expect(result.data.items[0].product.name).toBe('Trà đào cam sả');
  });

  it('4. getOrderById ném lỗi NotFoundException khi không tìm thấy đơn hoặc đơn thuộc người khác', async () => {
    mockPrismaService.order.findFirst.mockResolvedValue(null);

    await expect(
      controller.getOrderById('invalid-order-id', { id: 'user-123' }),
    ).rejects.toThrow(NotFoundException);
  });
});
