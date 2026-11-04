import { BadRequestException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const service = new InventoryService({} as PrismaService);

  it('combines base and topping ingredient amounts for every cup in the line', async () => {
    const tx = {
      recipe: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            items: [
              {
                ingredientId: 'coffee',
                quantity: new Prisma.Decimal(8),
                ingredient: { name: 'Coffee', isActive: true },
              },
            ],
          })
          .mockResolvedValueOnce({
            items: [
              {
                ingredientId: 'coffee',
                quantity: new Prisma.Decimal(3),
                ingredient: { name: 'Coffee', isActive: true },
              },
            ],
          }),
      },
    } as unknown as Prisma.TransactionClient;

    const usage = await service.getOrderItemUsage(
      tx,
      'product-1',
      'M',
      ['topping-1'],
      2,
    );

    expect(usage).toHaveLength(1);
    expect(usage[0].ingredientId).toBe('coffee');
    expect(usage[0].quantity.toNumber()).toBe(22);
  });

  it('deducts the saved order recipe into the ingredient ledger', async () => {
    const tx = {
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            ingredientUsages: [
              {
                ingredientId: 'coffee',
                quantity: new Prisma.Decimal(18),
              },
            ],
          },
        ]),
      },
      ingredient: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    await service.deductOrder(tx, 'order-1');

    expect(tx.ingredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'coffee',
          currentQuantity: { gte: new Prisma.Decimal(18) },
        }),
        data: { currentQuantity: { decrement: new Prisma.Decimal(18) } },
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        ingredientId: 'coffee',
        type: InventoryMovementType.ORDER_DEDUCTION,
        quantityDelta: new Prisma.Decimal(-18),
      }),
    });
  });

  it('does not record a deduction when ingredient stock is insufficient', async () => {
    const tx = {
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            ingredientUsages: [
              {
                ingredientId: 'coffee',
                quantity: new Prisma.Decimal(18),
              },
            ],
          },
        ]),
      },
      ingredient: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ name: 'Coffee' }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(service.deductOrder(tx, 'order-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('restores exactly the paid-order deduction when the order is cancelled', async () => {
    const tx = {
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            ingredientId: 'coffee',
            quantityDelta: new Prisma.Decimal(-12.5),
          },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      ingredient: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;

    await service.reverseOrder(tx, 'order-1', 'admin-1');

    expect(tx.ingredient.update).toHaveBeenCalledWith({
      where: { id: 'coffee' },
      data: { currentQuantity: { increment: new Prisma.Decimal(12.5) } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        ingredientId: 'coffee',
        actorId: 'admin-1',
        type: InventoryMovementType.ORDER_REVERSAL,
        quantityDelta: new Prisma.Decimal(12.5),
      }),
    });
  });

  it('adds received quantities to stock and records a purchase movement', async () => {
    const tx = {
      purchaseReceipt: {
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
      },
      ingredient: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      purchaseReceiptItem: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;

    await new InventoryService(prisma).createReceipt(
      { items: [{ ingredientId: 'coffee', quantity: 250 }] },
      'admin-1',
    );

    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: 'coffee', isActive: true },
      data: { currentQuantity: { increment: new Prisma.Decimal(250) } },
    });
    expect(tx.purchaseReceiptItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        receiptId: 'receipt-1',
        ingredientId: 'coffee',
        quantity: new Prisma.Decimal(250),
      }),
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ingredientId: 'coffee',
        type: InventoryMovementType.PURCHASE,
        quantityDelta: new Prisma.Decimal(250),
        receiptId: 'receipt-1',
        actorId: 'admin-1',
      }),
    });
  });

  it('subtracts inventory adjustments and prevents reducing below available stock', async () => {
    const tx = {
      ingredient: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'coffee' }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const inventory = new InventoryService(prisma);

    await inventory.adjustInventory(
      { ingredientId: 'coffee', quantityDelta: -20, note: 'Hao hụt' },
      'admin-1',
    );

    expect(tx.ingredient.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          id: 'coffee',
          isActive: true,
          currentQuantity: { gte: new Prisma.Decimal(20) },
        },
        data: { currentQuantity: { increment: new Prisma.Decimal(-20) } },
      },
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ingredientId: 'coffee',
        type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: new Prisma.Decimal(-20),
        actorId: 'admin-1',
      }),
    });

    await expect(
      inventory.adjustInventory(
        { ingredientId: 'coffee', quantityDelta: -1000, note: 'Điều chỉnh quá tồn' },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
  });
});
