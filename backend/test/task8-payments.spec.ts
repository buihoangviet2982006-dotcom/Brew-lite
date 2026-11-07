import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

describe('Task 8: Cashless Payment API (POST /payments - WALLET/CARD, PAID & PAYMENT_FAILED)', () => {
  let controller: PaymentsController;
  let currentOrderStatus: OrderStatus;

  const mockTx = {
    payment: {
      create: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const mockPrismaService = {
    payment: {
      findUnique: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockTx)),
  };

  const mockInventoryService = {
    deductOrder: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    currentOrderStatus = OrderStatus.PENDING;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);

    mockPrismaService.payment.findUnique.mockResolvedValue(null);
    mockPrismaService.order.findUnique.mockImplementation(async () => ({
      id: 'ord-01',
      orderNumber: '#1042',
      userId: 'usr-01',
      status: currentOrderStatus,
      total: new Prisma.Decimal(45000),
      pointsUsed: 0,
      voucherId: null,
    }));

    mockTx.payment.create.mockImplementation(async ({ data }) => ({
      id: 'pay-01',
      ...data,
    }));
    mockTx.order.update.mockImplementation(async ({ data }) => {
      currentOrderStatus = data.status;
      return {
        id: 'ord-01',
        orderNumber: '#1042',
        status: data.status,
        total: new Prisma.Decimal(45000),
        pointsEarned: data.pointsEarned ?? 0,
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Thanh toán thành công bằng Ví điện tử (WALLET) -> đơn chuyển sang PAID và trừ kho nguyên liệu', async () => {
    const res = await controller.directPayment(
      'idem-wallet-01',
      '',
      {
        orderId: 'ord-01',
        amount: 45000,
        method: PaymentMethod.WALLET,
      },
      { id: 'usr-01' },
    );

    expect(res.status).toBe('SUCCESS');
    expect(res.order?.status).toBe(OrderStatus.PAID);
    expect(mockInventoryService.deductOrder).toHaveBeenCalledWith(
      mockTx,
      'ord-01',
    );
  });

  it('2. Thanh toán lỗi (simulateFailure) -> đơn chuyển sang PAYMENT_FAILED, không trừ kho, cho phép thanh toán lại bằng Thẻ (CARD)', async () => {
    // Lần 1: Thanh toán lỗi
    const failedRes = await controller.directPayment(
      'idem-fail-01',
      '',
      {
        orderId: 'ord-01',
        amount: 45000,
        method: PaymentMethod.WALLET,
        simulateFailure: true,
      },
      { id: 'usr-01' },
    );

    expect(failedRes.status).toBe('FAILED');
    expect(failedRes.order?.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(mockInventoryService.deductOrder).not.toHaveBeenCalled();

    // Lần 2: Khách thử lại từ trạng thái PAYMENT_FAILED bằng Thẻ ngân hàng (CARD)
    const retryRes = await controller.directPayment(
      'idem-retry-card-02',
      '',
      {
        orderId: 'ord-01',
        amount: 45000,
        method: PaymentMethod.CARD,
      },
      { id: 'usr-01' },
    );

    expect(retryRes.status).toBe('SUCCESS');
    expect(retryRes.order?.status).toBe(OrderStatus.PAID);
    expect(mockInventoryService.deductOrder).toHaveBeenCalledTimes(1);
    expect(mockTx.payment.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: PaymentMethod.CARD,
          status: PaymentStatus.SUCCESS,
        }),
      }),
    );
  });
});

