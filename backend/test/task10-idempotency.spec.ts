import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';

describe('Task 10 (b): Idempotent Payment Test (processDirectPayment with Idempotency-Key)', () => {
  let moduleRef: TestingModule;
  let paymentsService: PaymentsService;
  let prisma: PrismaService;

  let testUserId: string;
  let testOrderId: string;
  let testProductId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // 1. Tạo sản phẩm mẫu có đủ kho
    const product = await prisma.product.create({
      data: {
        name: `CF Idempotent Test ${Date.now()}`,
        price: 35000,
        imageUrl: 'https://example.com/cf.png',
        stock: 20,
        version: 0,
        category: 'coffee',
      },
    });
    testProductId = product.id;

    // 2. Tạo user mẫu
    const user = await prisma.user.create({
      data: {
        email: `idem_user_${Date.now()}@brewlite.test`,
        passwordHash: 'hash',
        fullName: 'Idempotency Tester',
      },
    });
    testUserId = user.id;

    // 3. Tạo đơn hàng PENDING có orderItem
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
            },
          ],
        },
      },
    });
    testOrderId = order.id;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('Gửi 2 lần cùng Idempotency-Key: Request 2 trả kết quả cũ (isIdempotentReplay), DB chỉ lưu 1 bản ghi thanh toán duy nhất', async () => {
    const idempotencyKey = `IDEM_KEY_${Date.now()}_${Math.random()}`;
    const dto = {
      orderId: testOrderId,
      amount: 35000,
      method: PaymentMethod.WALLET,
    };

    // Lần gọi 1: Thanh toán thành công lần đầu
    const res1 = await paymentsService.processDirectPayment(dto, idempotencyKey, testUserId);
    expect(res1.status).toBe('SUCCESS');
    expect(res1.isIdempotentReplay).toBeUndefined();

    // Lần gọi 2: Gửi lặp lại cùng Idempotency-Key
    const res2 = await paymentsService.processDirectPayment(dto, idempotencyKey, testUserId);
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
  });
});
