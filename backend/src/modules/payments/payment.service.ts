import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertOrderTransition } from '../../common/order-state-machine';

@Injectable()
export class Task10PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async processPayment(
    orderId: string,
    userId: string,
    amount: number,
    method: PaymentMethod,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    // Nếu key đã tồn tại, trả lại kết quả trước đó.
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      if (existing.orderId !== orderId) {
        throw new ConflictException(
          'Idempotency key was already used for another order',
        );
      }

      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            userId,
          },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (
          order.status !== OrderStatus.PENDING &&
          order.status !== OrderStatus.PAYMENT_FAILED
        ) {
          throw new BadRequestException(
            `Cannot pay for an order with status ${order.status}`,
          );
        }

        if (Number(order.total) !== amount) {
          throw new BadRequestException('Payment amount does not match order total');
        }

        /*
         * Đây chỉ là phần ghi nhận thanh toán mẫu.
         * Phải xác nhận giao dịch thật thành công với cổng thanh toán
         * trước khi ghi PaymentStatus.SUCCESS.
         */
        const payment = await tx.payment.create({
          data: {
            orderId,
            amount,
            method,
            status: PaymentStatus.SUCCESS,
            idempotencyKey,
            transactionId: `MOCK-${idempotencyKey}`,
          },
        });

        assertOrderTransition(order.status as OrderStatus, OrderStatus.PAID);

        const updated = await tx.order.updateMany({
          where: {
            id: orderId,
            userId,
            status: order.status,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            'Order status changed. Please retry.',
          );
        }

        return payment;
      });
    } catch (error) {
      // Xử lý trường hợp hai request cùng sử dụng một idempotency key.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });

        if (winner && winner.orderId === orderId) {
          return winner;
        }
      }

      throw error;
    }
  }
}