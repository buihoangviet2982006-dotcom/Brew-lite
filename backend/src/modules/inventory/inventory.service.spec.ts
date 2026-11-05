import { BadRequestException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryService,
  OptimisticLockConflictError,
} from './inventory.service';

describe('InventoryService (Ingredient & Recipe Architecture)', () => {
  const service = new InventoryService({} as PrismaService);

  it('1. getOrderItemUsage: gộp định lượng nguyên liệu của công thức món (theo size) và topping nhân với số lượng ly', async () => {
    const tx = {
      recipe: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            items: [
              {
                ingredientId: 'ing-coffee',
                quantity: new Prisma.Decimal(18),
                ingredient: { name: 'Hạt cà phê', isActive: true },
              },
              {
                ingredientId: 'ing-milk',
                quantity: new Prisma.Decimal(100),
                ingredient: { name: 'Sữa tươi', isActive: true },
              },
            ],
          })
          .mockResolvedValueOnce({
            items: [
              {
                ingredientId: 'ing-pearl',
                quantity: new Prisma.Decimal(40),
                ingredient: { name: 'Trân châu đen', isActive: true },
              },
            ],
          }),
      },
    } as unknown as Prisma.TransactionClient;

    const usage = await service.getOrderItemUsage(
      tx,
      'prod-cf-02',
      'M',
      ['top-pearl'],
      2,
    );

    expect(usage).toEqual([
      { ingredientId: 'ing-coffee', quantity: new Prisma.Decimal(36) },
      { ingredientId: 'ing-milk', quantity: new Prisma.Decimal(200) },
      { ingredientId: 'ing-pearl', quantity: new Prisma.Decimal(80) },
    ]);
  });

  it('2. assertAvailable: chặn tạo đơn khi nguyên liệu trong kho không đủ', async () => {
    const tx = {
      ingredient: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ing-coffee',
            name: 'Hạt cà phê',
            isActive: true,
            currentQuantity: new Prisma.Decimal(10),
          },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.assertAvailable(tx, [
        { ingredientId: 'ing-coffee', quantity: new Prisma.Decimal(18) },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. deductOrder: trừ nguyên liệu kèm Optimistic Locking (version + 1) và lưu ORDER_DEDUCTION', async () => {
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
                ingredientId: 'ing-coffee',
                quantity: new Prisma.Decimal(18),
              },
            ],
          },
        ]),
      },
      ingredient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ing-coffee',
          name: 'Hạt cà phê',
          isActive: true,
          currentQuantity: new Prisma.Decimal(100),
          version: 4,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    await service.deductOrder(tx, 'order-1');

    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ing-coffee',
        isActive: true,
        version: 4,
        currentQuantity: { gte: new Prisma.Decimal(18) },
      },
      data: {
        currentQuantity: { decrement: new Prisma.Decimal(18) },
        version: { increment: 1 },
      },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        ingredientId: 'ing-coffee',
        type: InventoryMovementType.ORDER_DEDUCTION,
        quantityDelta: new Prisma.Decimal(-18),
      }),
    });
  });

  it('4. deductOrder: ném BadRequestException khi nguyên liệu không đủ tồn kho', async () => {
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
                ingredientId: 'ing-coffee',
                quantity: new Prisma.Decimal(50),
              },
            ],
          },
        ]),
      },
      ingredient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ing-coffee',
          name: 'Hạt cà phê',
          isActive: true,
          currentQuantity: new Prisma.Decimal(20),
          version: 1,
        }),
        updateMany: jest.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(service.deductOrder(tx, 'order-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.ingredient.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('5. deductOrder: ném OptimisticLockConflictError khi version bị thay đổi đồng thời nhưng kho vẫn còn đủ', async () => {
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
                ingredientId: 'ing-coffee',
                quantity: new Prisma.Decimal(18),
              },
            ],
          },
        ]),
      },
      ingredient: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'ing-coffee',
            name: 'Hạt cà phê',
            isActive: true,
            currentQuantity: new Prisma.Decimal(100),
            version: 1,
          })
          .mockResolvedValueOnce({
            id: 'ing-coffee',
            name: 'Hạt cà phê',
            isActive: true,
            currentQuantity: new Prisma.Decimal(82),
            version: 2,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(service.deductOrder(tx, 'order-1')).rejects.toThrow(
      OptimisticLockConflictError,
    );
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('6. reverseOrder: hoàn trả đúng lượng nguyên liệu đã trừ khi hủy đơn PAID', async () => {
    const tx = {
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            ingredientId: 'ing-coffee',
            quantityDelta: new Prisma.Decimal(-22.5),
          },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      ingredient: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as Prisma.TransactionClient;

    await service.reverseOrder(tx, 'order-1', 'barista-1');

    expect(tx.ingredient.update).toHaveBeenCalledWith({
      where: { id: 'ing-coffee' },
      data: {
        currentQuantity: { increment: new Prisma.Decimal(22.5) },
        version: { increment: 1 },
      },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        ingredientId: 'ing-coffee',
        actorId: 'barista-1',
        type: InventoryMovementType.ORDER_REVERSAL,
        quantityDelta: new Prisma.Decimal(22.5),
      }),
    });
  });
});
