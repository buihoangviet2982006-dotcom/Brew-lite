import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';

describe('Task 10 (c): Concurrency Control & Stock Integrity with Optimistic Locking', () => {
  let moduleRef: TestingModule;
  let paymentsService: PaymentsService;
  let prisma: PrismaService;

  let testProductId: string;
  let testUserId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // 1. Tạo sản phẩm Flash Sale với tồn kho chính xác = 3, version = 0
    const product = await prisma.product.create({
      data: {
        name: `CF Flash Sale Concurrency ${Date.now()}`,
        price: 30000,
        imageUrl: 'https://example.com/cf.png',
        stock: 3,
        version: 0,
        category: 'coffee',
      },
    });
    testProductId = product.id;

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
          orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
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
              },
            ],
          },
        },
      });
      orderIds.push(order.id);
    }
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('10 request thanh toán đồng thời cho kho = 3: Đúng 3 thành công, 7 thất bại, tồn kho về 0 (không bao giờ âm kho)', async () => {
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

    // Phải có đúng 3 giao dịch thành công ứng với stock = 3
    expect(successCount).toBe(3);
    // 7 giao dịch còn lại phải bị từ chối do xung đột optimistic locking hoặc hết hàng
    expect(failedCount).toBe(7);

    // Kiểm tra tính toàn vẹn tồn kho trong Database
    const finalProduct = await prisma.product.findUnique({
      where: { id: testProductId },
    });

    expect(finalProduct).toBeDefined();
    expect(finalProduct!.stock).toBe(0);
    expect(finalProduct!.version).toBe(3);
  });
});
