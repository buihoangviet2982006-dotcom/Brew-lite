import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { resolveTestPrisma } from './helpers/in-memory-prisma';

describe('Task 10 (b): Idempotent Payment Test (processDirectPayment with Idempotency-Key)', () => {
  let moduleRef: TestingModule;
  let paymentsService: PaymentsService;
  let prisma: PrismaService;
  let usingRealDb = false;

  let testUserId: string;
  let testOrderId: string;
  let testProductId: string;
  let testIngredientId: string;

  beforeAll(async () => {
    const resolved = await resolveTestPrisma();
    usingRealDb = resolved.usingRealDb;
    const prismaProvider = resolved.prisma;

    moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        InventoryService,
        { provide: PrismaService, useValue: prismaProvider },
      ],
    }).compile();

    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // 1. Tạo sản phẩm và nguyên liệu mẫu
    const product = await prisma.product.create({
      data: {
        name: `CF Idempotent Test ${Date.now()}`,
        price: 35000,
        imageUrl:
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        category: 'coffee',
      },
    });
    testProductId = product.id;

    const ingredient = await prisma.ingredient.create({
      data: {
        name: `Nguyên liệu idempotency ${Date.now()}`,
        unit: 'g',
        currentQuantity: 3,
        version: 0,
      },
    });
    testIngredientId = ingredient.id;
    await prisma.recipe.create({
      data: {
        productId: product.id,
        size: 'M',
        isProvisional: false,
        items: {
          create: [{ ingredientId: ingredient.id, quantity: 1 }],
        },
      },
    });

    // 2. Tạo user mẫu
    const user = await prisma.user.create({
      data: {
        email: `idem_user_${Date.now()}@brewlite.test`,
        passwordHash: 'hash',
        fullName: 'Idempotency Tester',
      },
    });
    testUserId = user.id;

    // 3. Tạo đơn hàng PENDING có orderItem và định lượng nguyên liệu
    const order = await prisma.order.create({
      data: {
        orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
        userId: testUserId,
        status: OrderStatus.PENDING,
        subtotal: 35000,
        discountAmount: 0,
        total: 35000,
        items: {
          create: [
            {
              productId: testProductId,
              size: 'M',
              qty: 1,
              basePrice: 35000,
              lineTotal: 35000,
              ingredientUsages: {
                create: [{ ingredientId: ingredient.id, quantity: 1 }],
              },
            },
          ],
        },
      },
    });
    testOrderId = order.id;
  });

  afterAll(async () => {
    if (prisma && testOrderId && testProductId && testIngredientId && testUserId) {
      await prisma.$transaction(async (tx) => {
        await tx.inventoryMovement.deleteMany({
          where: { ingredientId: testIngredientId, orderId: testOrderId },
        });
        await tx.payment.deleteMany({ where: { orderId: testOrderId } });
        await tx.order.delete({ where: { id: testOrderId } });
        await tx.recipe.deleteMany({ where: { productId: testProductId } });
        await tx.product.delete({ where: { id: testProductId } });
        await tx.ingredient.delete({ where: { id: testIngredientId } });
        await tx.user.delete({ where: { id: testUserId } });
      });
    }
    if (usingRealDb && prisma) {
      await prisma.$disconnect();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('Gửi 2 lần cùng Idempotency-Key: Request 2 trả kết quả cũ (isIdempotentReplay), DB chỉ lưu 1 bản ghi thanh toán và trừ nguyên liệu đúng 1 lần', async () => {
    const idempotencyKey = `IDEM_KEY_${Date.now()}_${Math.random()}`;
    const dto = {
      orderId: testOrderId,
      amount: 35000,
      method: PaymentMethod.WALLET,
    };

    // Lần gọi 1: Thanh toán thành công lần đầu
    const res1 = await paymentsService.processDirectPayment(
      dto,
      idempotencyKey,
      testUserId,
    );
    expect(res1.status).toBe('SUCCESS');
    expect(res1.isIdempotentReplay).toBeUndefined();

    // Lần gọi 2: Gửi lặp lại cùng Idempotency-Key
    const res2 = await paymentsService.processDirectPayment(
      dto,
      idempotencyKey,
      testUserId,
    );
    expect(res2.isIdempotentReplay).toBe(true);

    // Xác nhận trong Database chỉ lưu đúng 1 giao dịch thanh toán
    const paymentCount = await prisma.payment.count({
      where: { idempotencyKey },
    });
    expect(paymentCount).toBe(1);

    // Xác nhận trạng thái đơn hàng đã chuyển sang PAID
    const finalOrder = await prisma.order.findUnique({
      where: { id: testOrderId },
    });
    expect(finalOrder?.status).toBe(OrderStatus.PAID);

    // Xác nhận nguyên liệu chỉ bị trừ 1 lần (3 - 1 = 2) và version tăng lên 1
    const finalIngredient = await prisma.ingredient.findUnique({
      where: { id: testIngredientId },
    });
    expect(Number(finalIngredient?.currentQuantity)).toBe(2);
    expect(finalIngredient?.version).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { orderId: testOrderId, type: 'ORDER_DEDUCTION' },
      }),
    ).toBe(1);
  });
});
