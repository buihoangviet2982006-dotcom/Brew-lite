import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertTransition } from '../src/common/orders/order-state-machine';

describe('Task 10 (a): Order State Machine Validation (assertTransition & Business Flow)', () => {
  it('Cho phép các bước chuyển tiếp hợp lệ theo sơ đồ Mục 9.1', () => {
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

  it('Chặn nhảy cóc trực tiếp từ PENDING lên COMPLETED', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toThrow(
      BadRequestException,
    );
  });

  it('Chặn chuyển ngược trạng thái từ READY về PENDING', () => {
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.PENDING)).toThrow(
      BadRequestException,
    );
  });

  it('Chặn thay đổi trạng thái sau khi đơn đã kết thúc (COMPLETED hoặc CANCELLED)', () => {
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
});