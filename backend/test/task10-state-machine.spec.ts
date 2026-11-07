import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { assertTransition } from '../src/common/orders/order-state-machine';
import { OrdersService } from '../src/modules/orders/orders_service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Task 10 (a): Order State Machine Validation (assertTransition & Business Flow)', () => {
  it('1. Cho phép các bước chuyển tiếp hợp lệ theo sơ đồ Mục 9.1', () => {
    // Luồng happy path thành công
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAID)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.PREPARING)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.COMPLETED)).not.toThrow();

    // Các nhánh ngoại lệ cho phép
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).not.toThrow();
  });

  it('2. Chặn nhảy cóc trực tiếp từ PENDING lên COMPLETED hoặc PREPARING', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toThrow(
      BadRequestException,
    );
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PREPARING)).toThrow(
      BadRequestException,
    );
  });

  it('3. Chặn chuyển ngược trạng thái từ READY về PENDING', () => {
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.PENDING)).toThrow(
      BadRequestException,
    );
  });

  it('4. Chặn thay đổi trạng thái sau khi đơn đã kết thúc (COMPLETED hoặc CANCELLED)', () => {
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow(
      BadRequestException,
    );
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.PREPARING)).toThrow(
      BadRequestException,
    );
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toThrow(
      BadRequestException,
    );
  });

  it('5. OrdersService.updateStatus: chỉ cho phép BARISTA cập nhật trạng thái và hoàn nguyên liệu/voucher/điểm khi hủy đơn PAID', async () => {
    const mockReverseOrder = jest.fn().mockResolvedValue(undefined);
    const mockTx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord-paid-01',
          orderNumber: '#2026',
          userId: 'usr-01',
          status: OrderStatus.PAID,
          voucherId: 'vouch-01',
          pointsUsed: 50,
          pointsEarned: 3,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucher: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockTx)),
    } as unknown as PrismaService;
    const mockInventory = {
      reverseOrder: mockReverseOrder,
    } as unknown as InventoryService;

    const ordersService = new OrdersService(mockPrisma, mockInventory);

    // Khách hàng thường không được phép đổi trạng thái pha chế
    await expect(
      ordersService.updateStatus('ord-paid-01', OrderStatus.PREPARING, {
        id: 'usr-01',
        role: 'CUSTOMER',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Barista hủy đơn PAID -> hoàn nguyên liệu, giảm lượt dùng voucher, hoàn điểm đã dùng
    const res = await ordersService.updateStatus(
      'ord-paid-01',
      OrderStatus.CANCELLED,
      { id: 'barista-01', role: 'BARISTA' },
    );

    expect(res.success).toBe(true);
    expect(res.data.status).toBe(OrderStatus.CANCELLED);
    expect(mockReverseOrder).toHaveBeenCalledWith(
      mockTx,
      'ord-paid-01',
      'barista-01',
    );
    expect(mockTx.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'vouch-01', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'usr-01' },
      data: { loyaltyPoints: { increment: 47 } },
    });
  });
});
