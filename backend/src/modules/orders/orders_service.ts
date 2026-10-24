import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create_order_dto';

const POINT_VALUE_VND = 10;
const ORDER_NUMBER_ATTEMPTS = 5;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private generateOrderNumber(): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `#${randomNum}`;
  }

  private isOrderNumberCollision(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.includes('orderNumber')
      : typeof target === 'string' && target.includes('orderNumber');
  }

  private getProductPrice(
    product: { price: Prisma.Decimal; category: string; sizes: Prisma.JsonValue | null },
    size: string,
  ): Prisma.Decimal {
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      const sizeOption = product.sizes.find(
        (option): option is Prisma.JsonObject =>
          typeof option === 'object' &&
          option !== null &&
          !Array.isArray(option) &&
          option.size === size,
      );

      if (
        sizeOption &&
        (typeof sizeOption.price === 'number' ||
          typeof sizeOption.price === 'string')
      ) {
        return new Prisma.Decimal(sizeOption.price);
      }
      throw new BadRequestException('Kích thước không hợp lệ cho sản phẩm.');
    }

    if (product.category === 'bakery') {
      if (size === 'STANDARD') {
        return new Prisma.Decimal(product.price);
      }
      throw new BadRequestException('Kích thước không hợp lệ cho sản phẩm.');
    }

    if (size === 'S') {
      return new Prisma.Decimal(product.price);
    }
    if (size === 'M') {
      return new Prisma.Decimal(product.price).plus(5000);
    }
    if (size === 'L') {
      return new Prisma.Decimal(product.price).plus(10000);
    }

    throw new BadRequestException('Kích thước không hợp lệ cho sản phẩm.');
  }

  async create(dto: CreateOrderDto, userId: string) {
    if (!dto.items?.length) {
      throw new BadRequestException('Giỏ hàng không được để trống.');
    }

    for (const item of dto.items) {
      if (!Number.isSafeInteger(item.qty) || item.qty < 1) {
        throw new BadRequestException('Số lượng sản phẩm không hợp lệ.');
      }

      const toppingIds = item.toppings?.map((topping) => topping.toppingId) ?? [];
      if (new Set(toppingIds).size !== toppingIds.length) {
        throw new BadRequestException('Topping trong cùng một món không được trùng.');
      }
    }

    const normalizedVoucherCode = dto.voucherCode?.trim().toUpperCase();
    const normalizedVoucherId = dto.voucherId?.trim();
    if (dto.voucherCode !== undefined && !normalizedVoucherCode) {
      throw new BadRequestException('Mã voucher không được để trống.');
    }
    if (dto.voucherId !== undefined && !normalizedVoucherId) {
      throw new BadRequestException('Mã voucher không được để trống.');
    }

    for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
      const orderNumber = this.generateOrderNumber();

      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản đặt hàng.');
          }

          const productIds = [...new Set(dto.items.map((item) => item.productId))];
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
          });
          const productsById = new Map(products.map((product) => [product.id, product]));
          const requestedProductQuantities = new Map<string, number>();
          const requestedToppingQuantities = new Map<string, number>();
          for (const item of dto.items) {
            requestedProductQuantities.set(
              item.productId,
              (requestedProductQuantities.get(item.productId) ?? 0) + item.qty,
            );
            for (const selection of item.toppings ?? []) {
              requestedToppingQuantities.set(
                selection.toppingId,
                (requestedToppingQuantities.get(selection.toppingId) ?? 0) +
                  item.qty,
              );
            }
          }

          const allToppingIds = [
            ...new Set(
              dto.items.flatMap(
                (item) => item.toppings?.map((topping) => topping.toppingId) ?? [],
              ),
            ),
          ];
          const toppings = allToppingIds.length
            ? await tx.topping.findMany({
                where: { id: { in: allToppingIds }, isActive: true },
              })
            : [];
          const toppingsById = new Map(toppings.map((topping) => [topping.id, topping]));

          let subtotal = new Prisma.Decimal(0);
          const preparedItems = dto.items.map((item) => {
            const product = productsById.get(item.productId);
            if (!product) {
              throw new NotFoundException(
                `Không tìm thấy sản phẩm '${item.productId}'.`,
              );
            }
            if (
              !product.isAvailable ||
              product.stock < (requestedProductQuantities.get(product.id) ?? 0)
            ) {
              throw new BadRequestException(
                `Sản phẩm '${product.name}' hiện không đủ số lượng hoặc đã ngừng bán.`,
              );
            }

            const basePrice = this.getProductPrice(product, item.size);
            const toppingSnapshots = (item.toppings ?? []).map((selection) => {
              const topping = toppingsById.get(selection.toppingId);
              if (!topping) {
                throw new BadRequestException(
                  `Topping '${selection.toppingId}' không tồn tại hoặc đã ngừng bán.`,
                );
              }
              if (
                topping.stock < (requestedToppingQuantities.get(topping.id) ?? 0)
              ) {
                throw new BadRequestException(
                  `Topping '${topping.name}' hiện không đủ số lượng.`,
                );
              }

              return {
                toppingId: topping.id,
                name: topping.name,
                price: Number(topping.price),
              };
            });

            const toppingTotal = toppingSnapshots.reduce(
              (total, topping) => total.plus(topping.price),
              new Prisma.Decimal(0),
            );
            const lineTotal = basePrice.plus(toppingTotal).mul(item.qty);
            subtotal = subtotal.plus(lineTotal);

            return {
              productId: product.id,
              size: item.size,
              basePrice,
              qty: item.qty,
              lineTotal,
              toppings: toppingSnapshots,
            };
          });

          let voucherDiscount = new Prisma.Decimal(0);
          let voucher: Prisma.VoucherGetPayload<{}> | null = null;

          if (normalizedVoucherId || normalizedVoucherCode) {
            voucher = await tx.voucher.findFirst({
              where: {
                ...(normalizedVoucherId ? { id: normalizedVoucherId } : {}),
                ...(normalizedVoucherCode ? { code: normalizedVoucherCode } : {}),
              },
            });

            if (!voucher || !voucher.isActive) {
              throw new BadRequestException('Voucher không hợp lệ hoặc đã bị khóa.');
            }
            if (
              voucher.usageLimit !== null &&
              voucher.usedCount >= voucher.usageLimit
            ) {
              throw new BadRequestException('Voucher đã hết lượt sử dụng.');
            }
            if (
              voucher.minOrderValue !== null &&
              subtotal.lt(voucher.minOrderValue)
            ) {
              throw new BadRequestException(
                'Đơn hàng chưa đạt giá trị tối thiểu để sử dụng voucher.',
              );
            }

            if (voucher.discountType === 'PERCENT') {
              if (
                voucher.discountValue.lte(0) ||
                voucher.discountValue.gt(100)
              ) {
                throw new BadRequestException('Cấu hình giảm giá voucher không hợp lệ.');
              }
              voucherDiscount = subtotal
                .mul(voucher.discountValue)
                .div(100)
                .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
            } else {
              if (voucher.discountValue.lte(0)) {
                throw new BadRequestException('Cấu hình giảm giá voucher không hợp lệ.');
              }
              voucherDiscount = voucher.discountValue;
            }

            if (voucher.maxDiscount !== null && voucher.maxDiscount.lt(0)) {
              throw new BadRequestException('Cấu hình giảm giá voucher không hợp lệ.');
            }
            if (voucher.maxDiscount !== null && voucherDiscount.gt(voucher.maxDiscount)) {
              voucherDiscount = voucher.maxDiscount;
            }
            if (voucherDiscount.gt(subtotal)) {
              voucherDiscount = subtotal;
            }
          }

          const pointsUsed = dto.pointsUsed ?? 0;
          if (!Number.isSafeInteger(pointsUsed) || pointsUsed < 0) {
            throw new BadRequestException('Số điểm sử dụng không hợp lệ.');
          }
          if (pointsUsed > user.loyaltyPoints) {
            throw new BadRequestException('Bạn không có đủ điểm để sử dụng.');
          }

          const pointsDiscount = new Prisma.Decimal(pointsUsed).mul(POINT_VALUE_VND);
          const remainingAfterVoucher = subtotal.minus(voucherDiscount);
          if (pointsDiscount.gt(remainingAfterVoucher)) {
            throw new BadRequestException(
              'Số điểm sử dụng vượt quá số tiền còn lại của đơn hàng.',
            );
          }

          if (voucher) {
            const voucherUse = await tx.voucher.updateMany({
              where: {
                id: voucher.id,
                isActive: true,
                usageLimit: voucher.usageLimit,
                ...(voucher.usageLimit !== null
                  ? { usedCount: { lt: voucher.usageLimit } }
                  : {}),
              },
              data: { usedCount: { increment: 1 } },
            });
            if (voucherUse.count !== 1) {
              throw new BadRequestException('Voucher đã hết lượt sử dụng.');
            }
          }

          if (pointsUsed > 0) {
            const pointRedemption = await tx.user.updateMany({
              where: { id: userId, loyaltyPoints: { gte: pointsUsed } },
              data: { loyaltyPoints: { decrement: pointsUsed } },
            });
            if (pointRedemption.count !== 1) {
              throw new BadRequestException('Bạn không có đủ điểm để sử dụng.');
            }
          }

          const discountAmount = voucherDiscount.plus(pointsDiscount);
          const total = subtotal.minus(discountAmount);

          return tx.order.create({
            data: {
              orderNumber,
              userId,
              status: 'PENDING',
              subtotal,
              discountAmount,
              total,
              voucherId: voucher?.id ?? null,
              voucherCode: voucher?.code ?? null,
              pointsUsed,
              pointsEarned: 0,
              note: dto.note?.trim() || null,
              items: { create: preparedItems },
            },
            include: { items: true },
          });
        });

        return {
          success: true,
          message: 'Tạo đơn hàng thành công!',
          data: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            subtotal: Number(order.subtotal),
            discountAmount: Number(order.discountAmount),
            total: Number(order.total),
            itemsCount: order.items.length,
            createdAt: order.createdAt,
          },
        };
      } catch (error) {
        if (
          this.isOrderNumberCollision(error) &&
          attempt < ORDER_NUMBER_ATTEMPTS - 1
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Không thể tạo mã đơn hàng duy nhất.');
  }
}
