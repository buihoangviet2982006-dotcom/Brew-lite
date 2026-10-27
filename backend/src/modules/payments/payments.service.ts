import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
    const bankId = process.env.VIETQR_BANK_ID || this.vietQrConfig.bankId || 'MB';
    const accountNo = process.env.VIETQR_ACCOUNT_NO || this.vietQrConfig.accountNo || '0000000000';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || this.vietQrConfig.accountName || 'BREWLITE COFFEE';
    const accountNameEncoded = encodeURIComponent(accountName);
    
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${transferContent}&accountName=${accountNameEncoded}`;

    return {
      success: true,
      orderId: order.id,
      amount,
      transferContent,
      qrUrl,
      bankId,
      accountNo,
      accountName,
    };
  }

  /**
   * Tự động kiểm tra trạng thái thanh toán của đơn hàng (Polling realtime).
   * Nếu có cấu hình SEPAY_API_KEY, backend sẽ tự động truy vấn SePay để đối soát giao dịch ngân hàng thật.
   */
  async checkPaymentStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng ${orderId}`);
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');

    // Nếu đơn đã được cập nhật thành công trước đó
    if (order.status === OrderStatus.PAID) {
      return {
        status: OrderStatus.PAID,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.total),
          pointsEarned: order.pointsEarned,
        },
      };
    }

    // Nếu đơn đang PENDING và có SePay API Key, tự động truy vấn giao dịch ngân hàng
    const sepayApiKey = process.env.SEPAY_API_KEY?.trim();
    if (sepayApiKey && order.status === OrderStatus.PENDING) {
      try {
        const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=20', {
          headers: {
            Authorization: `Bearer ${sepayApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const transactions: any[] = data.transactions || data.messages || [];

          const expectedContentCode = `BL${order.id.slice(0, 8).toUpperCase()}`;
          const orderTotal = Number(order.total);

          const matchedTx = transactions.find((tx) => {
            const content = (tx.transaction_content || tx.content || '').toUpperCase();
            const amountIn = Number(tx.amount_in || tx.transferAmount || 0);
            return content.includes(expectedContentCode) && amountIn >= orderTotal;
          });

          if (matchedTx) {
            const refCode =
              matchedTx.reference_number ||
              matchedTx.referenceCode ||
              matchedTx.id?.toString() ||
              `SEPAY_${Date.now()}`;

            return await this.completePaymentSuccess(order, refCode, PaymentMethod.WALLET, 'SEPAY_AUTO');
          }
        }
      } catch (err) {
        console.error('Lỗi khi truy vấn SePay API:', err);
      }
    }

    return {
      status: order.status,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
      },
    };
  }

  /**
   * Tiếp nhận Webhook từ SePay khi có biến động số dư ngân hàng
   */
  async handleSepayWebhook(payload: any, authHeader?: string) {
    if (process.env.SEPAY_WEBHOOK_TOKEN) {
      const token = authHeader?.replace('Apikey ', '').replace('Bearer ', '').trim();
      if (token !== process.env.SEPAY_WEBHOOK_TOKEN.trim()) {
        throw new UnauthorizedException('Sai Webhook Token');
      }
    }

    const content = (payload.content || payload.transaction_content || '').toUpperCase();
    const amount = Number(payload.transferAmount || payload.amount_in || 0);

    if (!content || amount <= 0) {
      return { success: false, message: 'Dữ liệu giao dịch không hợp lệ' };
    }

    // Trích xuất mã đơn từ nội dung chuyển khoản: dạng BLxxxxxxxx
    const match = content.match(/BL([A-Z0-9]{8})/);
    let order = null;
    if (match) {
      const orderPrefix = match[1];
      order = await this.prisma.order.findFirst({
        where: {
          id: { startsWith: orderPrefix.toLowerCase() },
        },
      });
    }

    if (order && order.status === OrderStatus.PENDING) {
      if (amount >= Number(order.total)) {
        const refCode =
          payload.referenceCode ||
          payload.reference_number ||
          payload.id?.toString() ||
          `SEPAY_WH_${Date.now()}`;

        await this.completePaymentSuccess(order, refCode, PaymentMethod.WALLET, 'SEPAY_WH');
        return { success: true, orderId: order.id, status: 'PAID' };
      }
    }

    return { success: true, message: 'Đã nhận webhook SePay' };
  }

  /**
   * Giả lập tiền về từ SePay (Dùng cho môi trường Test / Demo bài tập lớn)
   */
  async simulateSepayTransfer(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng ${orderId}`);
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');

    if (order.status === OrderStatus.PAID) {
      return { status: OrderStatus.PAID, order };
    }

    const mockRefCode = `SEPAY_SIM_${Math.floor(100000 + Math.random() * 900000)}`;
    return await this.completePaymentSuccess(
      order,
      mockRefCode,
      PaymentMethod.WALLET,
      'SEPAY_SIM',
    );
  }

  /**
   * Helper chuyển trạng thái đơn hàng sang PAID và lưu giao dịch
   */
  private async completePaymentSuccess(
    order: any,
    transactionId: string,
    method: PaymentMethod,
    idempotencyPrefix: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const idempotencyKey = `${idempotencyPrefix}_${transactionId}_${order.id}`;
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existingPayment) {
        return { status: OrderStatus.PAID, order, payment: existingPayment };
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          idempotencyKey,
          amount: order.total,
          method,
          status: PaymentStatus.SUCCESS,
          transactionId,
        },
      });

      const earnedPoints = Math.floor(Number(order.total) / 10000);
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, pointsEarned: earnedPoints },
      });

      await tx.user.update({
        where: { id: order.userId },
        data: { loyaltyPoints: { increment: earnedPoints } },
      });

      if (order.voucherId) {
        await tx.voucher.update({
          where: { id: order.voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return {
        status: OrderStatus.PAID,
        payment,
        order: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          total: Number(updatedOrder.total),
          pointsEarned: earnedPoints,
        },
      };
    });
  }

  async processDirectPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
    userId: string,
  ): Promise<{
    status: 'SUCCESS' | 'FAILED' | PaymentStatus;
    isIdempotentReplay?: boolean;
    message?: string;
    payment: any;
    order?: {
      id: string;
      orderNumber: string | null;
      status: OrderStatus;
      total: number;
      pointsEarned?: number;
    };
  }> {
    if (!idempotencyKey) {
      throw new BadRequestException('Thiếu Idempotency-Key trong header');
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existingPayment) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { id: existingPayment.orderId },
      });
      return {
        status: existingPayment.status,
        isIdempotentReplay: true,
        payment: existingPayment,
        order: existingOrder
          ? {
              id: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              status: existingOrder.status,
              total: Number(existingOrder.total),
            }
          : undefined,
      };
    }

    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${dto.orderId}`);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    }

    // Kiểm tra Order State Machine theo đúng đề bài Mục 9.1
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán thành công trước đó.');
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
      throw new BadRequestException(
        `Đơn hàng đang ở trạng thái '${order.status}', không thể thực hiện thanh toán.`,
      );
    }

    // Kiểm tra số tiền thanh toán phải khớp với tổng đơn
    const orderTotalNum = Number(order.total);
    if (Math.abs(orderTotalNum - Number(dto.amount)) > 0.01) {
      throw new BadRequestException(
        `Số tiền thanh toán (${dto.amount}) không khớp với tổng tiền đơn hàng (${orderTotalNum}).`,
      );
    }

    const isSuccess = !dto.simulateFailure && dto.amount !== 999999;

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

        // Tích điểm thưởng cho khách: 10.000đ = 1 điểm (Task 10.4)
        const earnedPoints = Math.floor(Number(dto.amount) / 10000);
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID, pointsEarned: earnedPoints },
        });

        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: earnedPoints } },
        });

        // Nếu có voucher, tăng số lượt đã sử dụng
        if (order.voucherId) {
          await tx.voucher.update({
            where: { id: order.voucherId },
            data: { usedCount: { increment: 1 } },
          });
        }

        return {
          status: 'SUCCESS',
          payment,
          order: {
            id: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            total: Number(updatedOrder.total),
            pointsEarned: earnedPoints,
          },
        };
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

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAYMENT_FAILED },
        });

        return {
          status: 'FAILED',
          message: 'Giao dịch thanh toán không thành công. Giỏ hàng của bạn được giữ nguyên để có thể thử lại.',
          payment,
          order: {
            id: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            total: Number(updatedOrder.total),
          },
        };
      }
    });
  }
}