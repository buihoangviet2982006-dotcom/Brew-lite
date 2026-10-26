import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly vietQrConfig = {
    bankId: process.env.VIETQR_BANK_ID || 'MB',
    accountNo: process.env.VIETQR_ACCOUNT_NO || '0000000000',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'TEN CHU TAI KHOAN',
  };

  constructor(private readonly prisma: PrismaService) {}

  async generateVietQR(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng ${orderId}`);
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
      throw new BadRequestException(`Đơn hàng đang ở trạng thái ${order.status}`);
    }

    const amount = Number(order.total);
    const transferContent = `BL${order.id.slice(0, 8).toUpperCase()}`;
    const accountNameEncoded = encodeURIComponent(this.vietQrConfig.accountName);
    
    const qrUrl = `https://img.vietqr.io/image/${this.vietQrConfig.bankId}-${this.vietQrConfig.accountNo}-compact2.png?amount=${amount}&addInfo=${transferContent}&accountName=${accountNameEncoded}`;

    return { success: true, orderId: order.id, amount, transferContent, qrUrl };
  }

  async processDirectPayment(dto: CreatePaymentDto, idempotencyKey: string, userId: string) {
    if (!idempotencyKey) throw new BadRequestException('Thiếu Idempotency-Key');

    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existingPayment) return { isIdempotentReplay: true, payment: existingPayment };

    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');

    const isSuccess = dto.amount !== 999999; 

    return await this.prisma.$transaction(async (tx) => {
      if (isSuccess) {
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            amount: new Prisma.Decimal(dto.amount),
            method: dto.method,
            status: PaymentStatus.SUCCESS,
            transactionId: `TXN_${Date.now()}`,
          },
        });

        const earnedPoints = Math.floor(Number(dto.amount) / 10000);
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID, pointsEarned: earnedPoints },
        });
        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: earnedPoints } },
        });

        return { status: 'SUCCESS', payment };
      } else {
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            amount: new Prisma.Decimal(dto.amount),
            method: dto.method,
            status: PaymentStatus.FAILED,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAYMENT_FAILED },
        });

        return { status: 'FAILED', payment };
      }
    });
  }
}