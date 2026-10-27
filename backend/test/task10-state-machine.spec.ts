import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertTransition } from '../src/modules/orders/order-state-machine';

describe('Task 10 (a): Order State Machine Validation', () => {
  it('Cho phép các bước chuyển tiếp hợp lệ', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAID)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PAID, OrderStatus.PREPARING)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.COMPLETED)).not.toThrow();
  });

  it('Chặn nhảy cóc trực tiếp từ PENDING lên COMPLETED', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toThrow(
      BadRequestException
    );
  });

  it('Chặn chuyển ngược trạng thái từ READY về PENDING', () => {
    expect(() => assertTransition(OrderStatus.READY, OrderStatus.PENDING)).toThrow(
      BadRequestException
    );
  });

  it('Chặn thay đổi trạng thái sau khi đơn đã COMPLETED', () => {
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow(
      BadRequestException
    );
  });
});