import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { items: { include: { ingredient: true } } };
}>;

export interface IngredientUsage {
  ingredientId: string;
  quantity: Prisma.Decimal;
}

export class OptimisticLockConflictError extends Error {
  constructor(message = 'Xung đột dữ liệu tồn kho khi cập nhật đồng thời.') {
    super(message);
    this.name = 'OptimisticLockConflictError';
  }
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tính định lượng nguyên liệu cần dùng cho một dòng sản phẩm (gồm công thức món theo size + các topping).
   */
  async getOrderItemUsage(
    tx: Prisma.TransactionClient,
    productId: string,
    size: string,
    toppingIds: string[],
    quantity: number,
  ): Promise<IngredientUsage[]> {
    const recipeInclude = { items: { include: { ingredient: true } } } as const;
    const productRecipe = await tx.recipe.findFirst({
      where: { productId, size },
      include: recipeInclude,
    });
    if (!productRecipe || productRecipe.items.length === 0) {
      throw new BadRequestException(
        'Món này chưa có định lượng công thức; không thể đặt hàng.',
      );
    }

    const usage = new Map<string, Prisma.Decimal>();
    const addRecipe = (recipe: RecipeWithIngredients) => {
      if (recipe.items.length === 0) {
        throw new BadRequestException('Công thức topping chưa được thiết lập.');
      }
      for (const line of recipe.items) {
        if (!line.ingredient.isActive) {
          throw new BadRequestException(
            `Nguyên liệu '${line.ingredient.name}' hiện đã ngừng sử dụng.`,
          );
        }
        const needed = new Prisma.Decimal(line.quantity).mul(quantity);
        usage.set(
          line.ingredientId,
          (usage.get(line.ingredientId) ?? new Prisma.Decimal(0)).plus(needed),
        );
      }
    };

    addRecipe(productRecipe);
    for (const toppingId of toppingIds) {
      const recipe = await tx.recipe.findFirst({
        where: { toppingId },
        include: recipeInclude,
      });
      if (!recipe) {
        throw new BadRequestException(
          'Topping chưa có định lượng công thức; không thể đặt hàng.',
        );
      }
      addRecipe(recipe);
    }

    return [...usage].map(([ingredientId, needed]) => ({
      ingredientId,
      quantity: needed,
    }));
  }

  /**
   * Kiểm tra kho nguyên liệu có đủ đáp ứng toàn bộ đơn hàng trước khi tạo đơn PENDING.
   */
  async assertAvailable(
    tx: Prisma.TransactionClient,
    usages: IngredientUsage[],
  ) {
    const required = new Map<string, Prisma.Decimal>();
    for (const item of usages) {
      required.set(
        item.ingredientId,
        (required.get(item.ingredientId) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    }

    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: [...required.keys()] }, isActive: true },
    });
    const ingredientById = new Map(ingredients.map((item) => [item.id, item]));
    for (const [ingredientId, quantity] of required) {
      const ingredient = ingredientById.get(ingredientId);
      if (
        !ingredient ||
        new Prisma.Decimal(ingredient.currentQuantity).lt(quantity)
      ) {
        throw new BadRequestException(
          `Nguyên liệu '${ingredient?.name ?? ingredientId}' không đủ để hoàn tất đơn hàng.`,
        );
      }
    }
  }

  /**
   * Trừ tồn kho nguyên liệu theo công thức khi thanh toán đơn hàng (Task 10.3: Transaction + Optimistic Locking).
   */
  async deductOrder(tx: Prisma.TransactionClient, orderId: string) {
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        orderId,
        type: InventoryMovementType.ORDER_DEDUCTION,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: { ingredientUsages: true },
    });
    const required = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      let itemUsages: IngredientUsage[];
      if (item.ingredientUsages.length > 0) {
        itemUsages = item.ingredientUsages.map(({ ingredientId, quantity }) => ({
          ingredientId,
          quantity: new Prisma.Decimal(quantity),
        }));
      } else {
        const toppingIds: string[] = [];
        if (item.toppings !== null) {
          if (!Array.isArray(item.toppings)) {
            throw new BadRequestException('Dữ liệu topping của đơn hàng không hợp lệ.');
          }
          for (const selection of item.toppings) {
            if (
              typeof selection !== 'object' ||
              selection === null ||
              Array.isArray(selection) ||
              typeof selection.toppingId !== 'string'
            ) {
              throw new BadRequestException('Dữ liệu topping của đơn hàng không hợp lệ.');
            }
            toppingIds.push(selection.toppingId);
          }
        }

        const calculatedUsage = await this.getOrderItemUsage(
          tx,
          item.productId,
          item.size,
          toppingIds,
          item.qty,
        );
        await tx.orderIngredientUsage.createMany({
          data: calculatedUsage.map((usage) => ({
            orderItemId: item.id,
            ingredientId: usage.ingredientId,
            quantity: usage.quantity,
          })),
        });
        itemUsages = calculatedUsage;
      }

      for (const usage of itemUsages) {
        required.set(
          usage.ingredientId,
          (required.get(usage.ingredientId) ?? new Prisma.Decimal(0)).plus(
            usage.quantity,
          ),
        );
      }
    }

    if (required.size === 0) {
      throw new BadRequestException(
        'Đơn hàng chưa có định lượng nguyên liệu; không thể thanh toán.',
      );
    }

    for (const [ingredientId, quantity] of [...required].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const current = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        select: {
          id: true,
          name: true,
          isActive: true,
          currentQuantity: true,
          version: true,
        },
      });

      if (
        !current ||
        !current.isActive ||
        new Prisma.Decimal(current.currentQuantity).lt(quantity)
      ) {
        throw new BadRequestException(
          `Nguyên liệu '${current?.name ?? ingredientId}' không đủ tồn kho để thanh toán.`,
        );
      }

      // Optimistic Locking: chỉ cập nhật khi version khớp và currentQuantity >= quantity
      const updated = await tx.ingredient.updateMany({
        where: {
          id: ingredientId,
          isActive: true,
          version: current.version,
          currentQuantity: { gte: quantity },
        },
        data: {
          currentQuantity: { decrement: quantity },
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        const latest = await tx.ingredient.findUnique({
          where: { id: ingredientId },
          select: { name: true, isActive: true, currentQuantity: true },
        });
        if (
          !latest ||
          !latest.isActive ||
          new Prisma.Decimal(latest.currentQuantity).lt(quantity)
        ) {
          throw new BadRequestException(
            `Nguyên liệu '${latest?.name ?? current.name}' không đủ tồn kho để thanh toán.`,
          );
        }
        throw new OptimisticLockConflictError(
          `Xung đột phiên bản tồn kho nguyên liệu '${current.name}'.`,
        );
      }

      await tx.inventoryMovement.create({
        data: {
          ingredientId,
          orderId,
          type: InventoryMovementType.ORDER_DEDUCTION,
          quantityDelta: quantity.neg(),
          note: 'Trừ nguyên liệu khi thanh toán đơn hàng',
        },
      });
    }
  }

  /**
   * Hoàn trả nguyên liệu vào kho khi đơn hàng đã PAID bị hủy trước khi pha chế.
   */
  async reverseOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId: string,
  ) {
    const deductions = await tx.inventoryMovement.findMany({
      where: { orderId, type: InventoryMovementType.ORDER_DEDUCTION },
      include: { ingredient: { select: { name: true } } },
    });
    for (const deduction of deductions) {
      const alreadyReversed = await tx.inventoryMovement.findFirst({
        where: {
          orderId,
          ingredientId: deduction.ingredientId,
          type: InventoryMovementType.ORDER_REVERSAL,
        },
        select: { id: true },
      });
      if (alreadyReversed) {
        continue;
      }

      const quantity = new Prisma.Decimal(deduction.quantityDelta).abs();
      await tx.ingredient.update({
        where: { id: deduction.ingredientId },
        data: {
          currentQuantity: { increment: quantity },
          version: { increment: 1 },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          ingredientId: deduction.ingredientId,
          orderId,
          type: InventoryMovementType.ORDER_REVERSAL,
          quantityDelta: quantity,
          actorId,
          note: 'Hoàn nguyên liệu do hủy đơn trước khi pha',
        },
      });
    }
  }
}
