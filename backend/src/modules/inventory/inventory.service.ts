import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdjustInventoryDto,
  CreateIngredientDto,
  CreateReceiptDto,
  SaveRecipeDto,
  UpdateIngredientDto,
} from './dto/inventory.dto';

type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { items: { include: { ingredient: true } } };
}>;

export interface IngredientUsage {
  ingredientId: string;
  quantity: Prisma.Decimal;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [ingredients, products, toppings, receipts, movements] =
      await Promise.all([
        this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.product.findMany({
          orderBy: { name: 'asc' },
          include: {
            recipes: { include: { items: { include: { ingredient: true } } } },
          },
        }),
        this.prisma.topping.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            recipes: { include: { items: { include: { ingredient: true } } } },
          },
        }),
        this.prisma.purchaseReceipt.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
          },
        }),
        this.prisma.inventoryMovement.findMany({
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
            actor: { select: { fullName: true, email: true } },
          },
        }),
      ]);

    const ingredientById = new Map(
      ingredients
        .filter((item) => item.isActive)
        .map((item) => [item.id, item]),
    );
    const recipes = [
      ...products.flatMap((product) =>
        product.recipes.map((recipe) => ({
          id: recipe.id,
          productId: product.id,
          toppingId: null,
          name: product.name,
          size: recipe.size,
          isProvisional: recipe.isProvisional,
          items: recipe.items.map((item) => ({
            ingredientId: item.ingredientId,
            ingredientName: item.ingredient.name,
            unit: item.ingredient.unit,
            quantity: Number(item.quantity),
          })),
        })),
      ),
      ...toppings.flatMap((topping) =>
        topping.recipes.map((recipe) => ({
          id: recipe.id,
          productId: null,
          toppingId: topping.id,
          name: topping.name,
          size: null,
          isProvisional: recipe.isProvisional,
          items: recipe.items.map((item) => ({
            ingredientId: item.ingredientId,
            ingredientName: item.ingredient.name,
            unit: item.ingredient.unit,
            quantity: Number(item.quantity),
          })),
        })),
      ),
    ];

    const estimates = [
      ...products.flatMap((product) =>
        this.getProductSizes(product).map((size) => {
          const recipe = product.recipes.find((item) => item.size === size);
          return this.toEstimate({
            targetId: product.id,
            targetName: product.name,
            size,
            recipe,
            ingredientById,
          });
        }),
      ),
      ...toppings.map((topping) =>
        this.toEstimate({
          targetId: topping.id,
          targetName: topping.name,
          size: null,
          recipe: topping.recipes[0],
          ingredientById,
          isTopping: true,
        }),
      ),
    ];

    return {
      ingredients: ingredients.map((item) => ({
        ...item,
        currentQuantity: Number(item.currentQuantity),
        lowStockThreshold: Number(item.lowStockThreshold),
      })),
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        sizes: this.getProductSizes(product),
      })),
      toppings: toppings.map(({ id, name }) => ({ id, name })),
      recipes,
      estimates,
      receipts: receipts.map((receipt) => ({
        ...receipt,
        items: receipt.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitCost: item.unitCost === null ? null : Number(item.unitCost),
        })),
      })),
      movements: movements.map((movement) => ({
        ...movement,
        quantityDelta: Number(movement.quantityDelta),
      })),
    };
  }

  async createIngredient(dto: CreateIngredientDto) {
    try {
      const ingredient = await this.prisma.ingredient.create({
        data: {
          name: dto.name.trim(),
          unit: dto.unit.trim(),
          lowStockThreshold: new Prisma.Decimal(dto.lowStockThreshold ?? 0),
        },
      });
      return this.mapIngredient(ingredient);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Tên nguyên liệu đã tồn tại.');
      }
      throw error;
    }
  }

  async updateIngredient(id: string, dto: UpdateIngredientDto) {
    const current = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Không tìm thấy nguyên liệu.');
    }

    if (dto.unit && dto.unit.trim() !== current.unit) {
      const [recipeUse, movement, receiptUse, orderUse] = await Promise.all([
        this.prisma.recipeIngredient.findFirst({
          where: { ingredientId: id },
          select: { recipeId: true },
        }),
        this.prisma.inventoryMovement.findFirst({
          where: { ingredientId: id },
          select: { id: true },
        }),
        this.prisma.purchaseReceiptItem.findFirst({
          where: { ingredientId: id },
          select: { id: true },
        }),
        this.prisma.orderIngredientUsage.findFirst({
          where: { ingredientId: id },
          select: { id: true },
        }),
      ]);
      if (
        !current.currentQuantity.isZero() ||
        recipeUse ||
        movement ||
        receiptUse ||
        orderUse
      ) {
        throw new BadRequestException(
          'Không thể đổi đơn vị nguyên liệu đã có công thức hoặc lịch sử kho. Hãy tạo nguyên liệu mới và cập nhật công thức.',
        );
      }
    }

    try {
      const ingredient = await this.prisma.ingredient.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.unit === undefined ? {} : { unit: dto.unit.trim() }),
          ...(dto.lowStockThreshold === undefined
            ? {}
            : { lowStockThreshold: new Prisma.Decimal(dto.lowStockThreshold) }),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        },
      });
      return this.mapIngredient(ingredient);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Tên nguyên liệu đã tồn tại.');
      }
      throw error;
    }
  }

  async saveRecipe(dto: SaveRecipeDto) {
    const hasProduct = Boolean(dto.productId);
    const hasTopping = Boolean(dto.toppingId);
    if (hasProduct === hasTopping || (hasProduct && !dto.size) || (hasTopping && dto.size)) {
      throw new BadRequestException(
        'Công thức phải thuộc một sản phẩm-size hoặc một topping.',
      );
    }

    const ingredientIds = dto.items.map((item) => item.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException('Nguyên liệu trong cùng công thức không được trùng.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.productId) {
        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          select: { id: true, sizes: true, category: true },
        });
        if (!product) {
          throw new NotFoundException('Không tìm thấy sản phẩm.');
        }
        if (!this.getProductSizes(product).includes(dto.size!)) {
          throw new BadRequestException('Size không hợp lệ cho sản phẩm.');
        }
      } else {
        const topping = await tx.topping.findUnique({
          where: { id: dto.toppingId },
          select: { id: true },
        });
        if (!topping) {
          throw new NotFoundException('Không tìm thấy topping.');
        }
      }

      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds }, isActive: true },
        select: { id: true },
      });
      if (ingredients.length !== ingredientIds.length) {
        throw new BadRequestException(
          'Công thức có nguyên liệu không tồn tại hoặc đã ngừng sử dụng.',
        );
      }

      const existing = await tx.recipe.findFirst({
        where: dto.productId
          ? { productId: dto.productId, size: dto.size }
          : { toppingId: dto.toppingId },
      });
      const recipe = existing
        ? await tx.recipe.update({
            where: { id: existing.id },
            data: { isProvisional: dto.isProvisional },
          })
        : await tx.recipe.create({
            data: {
              productId: dto.productId ?? null,
              toppingId: dto.toppingId ?? null,
              size: dto.size ?? null,
              isProvisional: dto.isProvisional,
            },
          });

      await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeIngredient.createMany({
        data: dto.items.map((item) => ({
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
          quantity: new Prisma.Decimal(item.quantity),
        })),
      });

      return { success: true, recipeId: recipe.id };
    });
  }

  async createReceipt(dto: CreateReceiptDto, actorId: string) {
    const ingredientIds = dto.items.map((item) => item.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException('Mỗi nguyên liệu chỉ được xuất hiện một lần trong phiếu.');
    }

    const receiptNumber = `PN-${Date.now()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptNumber,
          supplierName: dto.supplierName?.trim() || null,
          invoiceNumber: dto.invoiceNumber?.trim() || null,
          note: dto.note?.trim() || null,
          createdById: actorId,
        },
      });

      for (const item of dto.items) {
        const quantity = new Prisma.Decimal(item.quantity);
        const updated = await tx.ingredient.updateMany({
          where: { id: item.ingredientId, isActive: true },
          data: { currentQuantity: { increment: quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            'Phiếu nhập có nguyên liệu không tồn tại hoặc đã ngừng sử dụng.',
          );
        }

        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            ingredientId: item.ingredientId,
            quantity,
            unitCost:
              item.unitCost === undefined ? null : new Prisma.Decimal(item.unitCost),
          },
        });
        await tx.inventoryMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: InventoryMovementType.PURCHASE,
            quantityDelta: quantity,
            receiptId: receipt.id,
            actorId,
            note: `Nhập theo phiếu ${receiptNumber}`,
          },
        });
      }

      return {
        success: true,
        message: 'Đã lưu phiếu và cộng số lượng vào tồn kho.',
        receiptNumber,
      };
    });
  }

  async adjustInventory(dto: AdjustInventoryDto, actorId: string) {
    if (!Number.isFinite(dto.quantityDelta) || dto.quantityDelta === 0) {
      throw new BadRequestException('Số lượng điều chỉnh phải khác 0.');
    }

    const delta = new Prisma.Decimal(dto.quantityDelta);
    const where: Prisma.IngredientWhereInput = {
      id: dto.ingredientId,
      isActive: true,
      ...(delta.isNegative()
        ? { currentQuantity: { gte: delta.abs() } }
        : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ingredient.updateMany({
        where,
        data: { currentQuantity: { increment: delta } },
      });
      if (updated.count !== 1) {
        const ingredient = await tx.ingredient.findUnique({
          where: { id: dto.ingredientId },
          select: { id: true },
        });
        if (!ingredient) {
          throw new NotFoundException('Không tìm thấy nguyên liệu.');
        }
        throw new BadRequestException(
          'Số lượng điều chỉnh vượt quá tồn kho hiện có hoặc nguyên liệu đã ngừng sử dụng.',
        );
      }

      await tx.inventoryMovement.create({
        data: {
          ingredientId: dto.ingredientId,
          type: InventoryMovementType.ADJUSTMENT,
          quantityDelta: delta,
          note: dto.note.trim(),
          actorId,
        },
      });

      return { success: true, message: 'Đã điều chỉnh tồn kho.' };
    });
  }

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
        'Món này chưa có định lượng công thức; vui lòng báo quản trị viên.',
      );
    }

    const usage = new Map<string, Prisma.Decimal>();
    const addRecipe = (recipe: RecipeWithIngredients) => {
      if (recipe.items.length === 0) {
        throw new BadRequestException('Công thức có topping chưa được thiết lập.');
      }
      for (const line of recipe.items) {
        if (!line.ingredient.isActive) {
          throw new BadRequestException(
            `Nguyên liệu '${line.ingredient.name}' đã ngừng sử dụng.`,
          );
        }
        const needed = line.quantity.mul(quantity);
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
          'Topping chưa có định lượng công thức; vui lòng báo quản trị viên.',
        );
      }
      addRecipe(recipe);
    }

    return [...usage].map(([ingredientId, needed]) => ({
      ingredientId,
      quantity: needed,
    }));
  }

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
      if (!ingredient || ingredient.currentQuantity.lt(quantity)) {
        throw new BadRequestException(
          `Nguyên liệu '${ingredient?.name ?? ingredientId}' không đủ để hoàn tất đơn hàng.`,
        );
      }
    }
  }

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
          quantity,
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

        const legacyUsage = await this.getOrderItemUsage(
          tx,
          item.productId,
          item.size,
          toppingIds,
          item.qty,
        );
        await tx.orderIngredientUsage.createMany({
          data: legacyUsage.map((usage) => ({
            orderItemId: item.id,
            ingredientId: usage.ingredientId,
            quantity: usage.quantity,
          })),
        });
        itemUsages = legacyUsage;
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
      const updated = await tx.ingredient.updateMany({
        where: {
          id: ingredientId,
          isActive: true,
          currentQuantity: { gte: quantity },
        },
        data: { currentQuantity: { decrement: quantity } },
      });
      if (updated.count !== 1) {
        const ingredient = await tx.ingredient.findUnique({
          where: { id: ingredientId },
          select: { name: true },
        });
        throw new BadRequestException(
          `Nguyên liệu '${ingredient?.name ?? ingredientId}' không đủ tồn kho để thanh toán.`,
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

  async reverseOrder(tx: Prisma.TransactionClient, orderId: string, actorId: string) {
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

      const quantity = deduction.quantityDelta.abs();
      await tx.ingredient.update({
        where: { id: deduction.ingredientId },
        data: { currentQuantity: { increment: quantity } },
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

  private toEstimate({
    targetId,
    targetName,
    size,
    recipe,
    ingredientById,
    isTopping = false,
  }: {
    targetId: string;
    targetName: string;
    size: string | null;
    recipe?: RecipeWithIngredients;
    ingredientById: Map<string, { name: string; currentQuantity: Prisma.Decimal }>;
    isTopping?: boolean;
  }) {
    if (!recipe || recipe.items.length === 0) {
      return {
        targetId,
        targetName,
        size,
        isTopping,
        isProvisional: null,
        estimatedServings: null,
        limitingIngredient: null,
      };
    }

    const capacities = recipe.items.map((item) => {
      const ingredient = ingredientById.get(item.ingredientId);
      return {
        name: ingredient?.name ?? item.ingredient.name,
        capacity: Math.floor(
          (ingredient?.currentQuantity.toNumber() ?? 0) /
            item.quantity.toNumber(),
        ),
      };
    });
    const limitingIngredient = capacities.reduce((lowest, item) =>
      item.capacity < lowest.capacity ? item : lowest,
    );

    return {
      targetId,
      targetName,
      size,
      isTopping,
      isProvisional: recipe.isProvisional,
      estimatedServings: limitingIngredient.capacity,
      limitingIngredient: limitingIngredient.name,
    };
  }

  private getProductSizes(product: {
    category: string;
    sizes: Prisma.JsonValue | null;
  }): string[] {
    if (Array.isArray(product.sizes)) {
      const sizes = product.sizes.flatMap((entry) => {
        if (
          typeof entry === 'object' &&
          entry !== null &&
          !Array.isArray(entry) &&
          typeof entry.size === 'string'
        ) {
          return [entry.size];
        }
        return [];
      });
      if (sizes.length > 0) {
        return sizes;
      }
    }
    return product.category === 'bakery' ? ['STANDARD'] : ['S', 'M', 'L'];
  }

  private mapIngredient<T extends { currentQuantity: Prisma.Decimal; lowStockThreshold: Prisma.Decimal }>(
    ingredient: T,
  ) {
    return {
      ...ingredient,
      currentQuantity: Number(ingredient.currentQuantity),
      lowStockThreshold: Number(ingredient.lowStockThreshold),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
