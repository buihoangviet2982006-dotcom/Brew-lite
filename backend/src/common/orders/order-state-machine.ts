import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

export { OrderStatus };

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function assertOrderTransition(
  currentStatus: OrderStatus | string,
  nextStatus: OrderStatus | string,
): void {
  const allowedStatuses = ORDER_TRANSITIONS[currentStatus as OrderStatus];

  if (!allowedStatuses?.includes(nextStatus as OrderStatus)) {
    throw new BadRequestException(
      `Cannot change order status from ${currentStatus} to ${nextStatus}`,
    );
  }
}

export const assertTransition = assertOrderTransition;