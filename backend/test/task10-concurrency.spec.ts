import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { resolveTestPrisma } from './helpers/in-memory-prisma';

describe('Task 10 (c): Concurrency Control & Ingredient Stock Integrity with Optimistic Locking', () => {
  let moduleRef: TestingModule;
  let paymentsService: PaymentsService;
  let prisma: PrismaService;
  let usingRealDb = false;

  let testProductId: string;
  let testUserId: string;
  let testIngredientId: string;
  const orderIds: string[] = [];

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

    // 1. Tạo sản phẩm Flash Sale và nguyên liệu có tồn kho chính xác = 3 g
    const product = await prisma.product.create({
      data: {
        name: `CF Flash Sale Concurrency ${Date.now()}`,
        price: 30000,
        imageUrl:
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
        category: 'coffee',
      },
    });
    testProductId = product.id;

    const ingredient = await prisma.ingredient.create({
      data: {
        name: `Nguyên liệu concurrency ${Date.now()}`,
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

    // 2. Tạo user
    const user = await prisma.user.create({
      data: {
        email: `conc_user_${Date.now()}@brewlite.test`,
        passwordHash: 'hash',
        fullName: 'Concurrency Tester',
      },
    });
    testUserId = user.id;

    // 3. Tạo 10 đơn hàng PENDING cạnh tranh mua cùng sản phẩm này
    for (let i = 0; i < 10; i++) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `#${1000 + i}`,
          userId: testUserId,
          status: OrderStatus.PENDING,
          subtotal: 30000,
          discountAmount: 0,
          total: 30000,
          items: {
            create: [
              {
                productId: testProductId,
                size: 'M',
                qty: 1,
                basePrice: 30000,
                lineTotal: 30000,
                ingredientUsages: {
                  create: [{ ingredientId: ingredient.id, quantity: 1 }],
                },
              },
            ],
          },
        },
      });
      orderIds.push(order.id);
    }
  });

  afterAll(async () => {
    if (prisma && testProductId && testIngredientId && testUserId) {
      await prisma.$transaction(async (tx) => {
        await tx.inventoryMovement.deleteMany({
          where: {
            OR: [
              { ingredientId: testIngredientId },
              ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
            ],
          },
        });
        if (orderIds.length > 0) {
          await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.order.deleteMany({ where: { id: { in: orderIds } } });
        }
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

  it('10 request thanh toán đồng thời cho kho nguyên liệu = 3g (mỗi đơn cần 1g): Đúng 3 thành công, 7 thất bại, tồn kho về 0 và version tăng đúng 3 lần', async () => {
    const requests = orderIds.map(async (orderId, idx) => {
      try {
        const idempotencyKey = `CONC_KEY_${orderId}_${idx}`;
        const res = await paymentsService.processDirectPayment(
          {
            orderId,
            amount: 30000,
            method: PaymentMethod.WALLET,
          },
          idempotencyKey,
          testUserId,
        );
        return { status: 'SUCCESS', result: res };
      } catch (error) {
        return { status: 'FAILED', error };
      }
    });

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;

    // Phải có đúng 3 giao dịch thành công ứng với 3g nguyên liệu
    expect(successCount).toBe(3);
    // 7 giao dịch còn lại phải bị từ chối khi kho nguyên liệu đã cạn
    expect(failedCount).toBe(7);

    const finalIngredient = await prisma.ingredient.findUnique({
      where: { id: testIngredientId },
    });
    expect(Number(finalIngredient?.currentQuantity)).toBe(0);
    expect(finalIngredient?.version).toBe(3);
    expect(
      await prisma.inventoryMovement.count({
        where: { ingredientId: testIngredientId, type: 'ORDER_DEDUCTION' },
      }),
    ).toBe(3);
  });
});
