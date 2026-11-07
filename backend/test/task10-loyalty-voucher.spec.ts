import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DiscountType, PaymentMethod } from '@prisma/client';
import { OrdersService } from '../src/modules/orders/orders_service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createInMemoryPrisma } from './helpers/in-memory-prisma';

describe('Task 10 (d): Vouchers & Loyalty Points Integration (Create Order -> Pay Order)', () => {
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let prisma: ReturnType<typeof createInMemoryPrisma>;

  let userId: string;
  let productId: string;

  beforeEach(async () => {
    prisma = createInMemoryPrisma();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PaymentsService,
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    ordersService = moduleRef.get<OrdersService>(OrdersService);
    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);

    // Seed nguyên liệu + sản phẩm + công thức
    const coffee = await prisma.ingredient.create({
      data: {
        id: 'ing-cf-loyalty',
        name: 'Hạt cà phê Loyalty',
        unit: 'g',
        currentQuantity: 1000,
        version: 0,
      },
    });

    const product = await prisma.product.create({
      data: {
        id: 'prod-loyalty',
        name: 'Cà phê đặc biệt',
        price: 50000,
        imageUrl: 'https://example.com/cf.jpg',
        category: 'coffee',
        sizes: [{ size: 'M', price: 50000 }],
      },
    });
    productId = product.id;

    await prisma.recipe.create({
      data: {
        productId: product.id,
        size: 'M',
        items: {
          create: [{ ingredientId: coffee.id, quantity: 20 }],
        },
      },
    });

    // Seed voucher PERCENT (10%, tối đa 8.000đ, đơn tối thiểu 40.000đ)
    await prisma.voucher.create({
      data: {
        id: 'vouch-10',
        code: 'BREWLITE10',
        discountType: DiscountType.PERCENT,
        discountValue: 10,
        minOrderValue: 40000,
        maxDiscount: 8000,
        usageLimit: 1,
        usedCount: 0,
        isActive: true,
      },
    });

    // Seed user có 200 điểm tích lũy (= 2.000đ)
    const user = await prisma.user.create({
      data: {
        id: 'usr-loyalty-1',
        email: 'loyalty@brewlite.vn',
        passwordHash: 'hash',
        fullName: 'Khách Thân Thiết',
        loyaltyPoints: 200,
      },
    });
    userId = user.id;
  });

  it('1. Áp mã giảm giá hợp lệ + dùng điểm tích lũy khi đặt đơn, và tự động trừ điểm đã dùng + cộng điểm thưởng mới sau khi PAID', async () => {
    // Đặt 2 ly (2 * 50.000 = 100.000đ)
    // Voucher 10% của 100.000đ là 10.000đ nhưng chạm trần maxDiscount = 8.000đ
    // Dùng thêm 200 điểm = 2.000đ -> Tổng giảm = 10.000đ -> Thành tiền = 90.000đ
    const created = await ordersService.create(
      {
        items: [{ productId, size: 'M', qty: 2 }],
        voucherCode: 'brewlite10',
        pointsUsed: 200,
      },
      userId,
    );

    expect(created.data.subtotal).toBe(100000);
    expect(created.data.discountAmount).toBe(10000);
    expect(created.data.total).toBe(90000);

    // Khi mới PENDING, điểm của user vẫn giữ nguyên 200 và voucher usedCount vẫn = 0
    const userBeforePay = await prisma.user.findUnique({ where: { id: userId } });
    expect(userBeforePay.loyaltyPoints).toBe(200);

    // Thực hiện thanh toán đơn hàng (90.000đ -> tích được 9 điểm mới)
    const paid = await paymentsService.processDirectPayment(
      {
        orderId: created.data.id,
        amount: 90000,
        method: PaymentMethod.WALLET,
      },
      'IDEM_LOYALTY_01',
      userId,
    );

    expect(paid.status).toBe('SUCCESS');
    expect(paid.order?.status).toBe('PAID');
    expect(paid.order?.pointsEarned).toBe(9);

    // Điểm của user sau khi PAID: 200 - 200 (đã dùng) + 9 (tích mới) = 9 điểm
    const userAfterPay = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfterPay.loyaltyPoints).toBe(9);

    // Voucher usedCount tăng lên 1
    const voucherAfterPay = await prisma.voucher.findUnique({
      where: { id: 'vouch-10' },
    });
    expect(voucherAfterPay.usedCount).toBe(1);

    // Đặt tiếp đơn thứ 2 với cùng voucher đã hết lượt (usageLimit = 1) -> bị từ chối
    await expect(
      ordersService.create(
        {
          items: [{ productId, size: 'M', qty: 1 }],
          voucherCode: 'BREWLITE10',
        },
        userId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

