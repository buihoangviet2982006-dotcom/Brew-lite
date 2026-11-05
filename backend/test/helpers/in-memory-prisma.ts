import * as net from 'net';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function resolveTestPrisma(): Promise<{
  prisma: any;
  usingRealDb: boolean;
}> {
  const isPortOpen = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(5432, '127.0.0.1');
  });

  if (isPortOpen) {
    const realPrisma = new PrismaService();
    try {
      await realPrisma.$connect();
      return { prisma: realPrisma, usingRealDb: true };
    } catch {
      await realPrisma.$disconnect().catch(() => undefined);
    }
  }

  return { prisma: createInMemoryPrisma(), usingRealDb: false };
}

/**
 * In-memory Stateful Prisma Mock phục vụ chạy Integration Test (Idempotency, Concurrency + Optimistic Locking, Loyalty & Voucher)
 * khi máy local không bật sẵn dịch vụ PostgreSQL ở cổng 5432.
 * Khi chạy trên CI (GitHub Actions) hoặc Docker có PostgreSQL thật, bài test sẽ ưu tiên kết nối PostgreSQL thật.
 */
export function createInMemoryPrisma() {
  const products = new Map<string, any>();
  const toppings = new Map<string, any>();
  const ingredients = new Map<string, any>();
  const recipes = new Map<string, any>();
  const users = new Map<string, any>();
  const vouchers = new Map<string, any>();
  const orders = new Map<string, any>();
  const orderItems = new Map<string, any>();
  const payments = new Map<string, any>();
  const inventoryMovements = new Map<string, any>();

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}_${Date.now()}_${idSeq++}`;

  const client: any = {
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),

    product: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('prod');
        const record = {
          id,
          name: data.name,
          price: new Prisma.Decimal(data.price),
          imageUrl: data.imageUrl,
          category: data.category || 'coffee',
          sizes: data.sizes ?? null,
          isAvailable: data.isAvailable ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        products.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        const found = products.get(where.id);
        return found ? { ...found } : null;
      },
      findMany: async ({ where }: any = {}) => {
        const all = [...products.values()];
        if (where?.id?.in) {
          return all.filter((p) => where.id.in.includes(p.id)).map((p) => ({ ...p }));
        }
        return all.map((p) => ({ ...p }));
      },
      delete: async ({ where }: any) => {
        products.delete(where.id);
      },
    },

    ingredient: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('ing');
        const record = {
          id,
          name: data.name,
          unit: data.unit,
          currentQuantity: new Prisma.Decimal(data.currentQuantity ?? 0),
          lowStockThreshold: new Prisma.Decimal(data.lowStockThreshold ?? 0),
          version: data.version ?? 0,
          isActive: data.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        ingredients.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        const found = ingredients.get(where.id);
        return found ? { ...found } : null;
      },
      findMany: async ({ where }: any = {}) => {
        const all = [...ingredients.values()];
        return all
          .filter((item) => {
            if (where?.id?.in && !where.id.in.includes(item.id)) return false;
            if (where?.isActive !== undefined && item.isActive !== where.isActive)
              return false;
            return true;
          })
          .map((item) => ({ ...item }));
      },
      update: async ({ where, data }: any) => {
        const existing = ingredients.get(where.id);
        if (!existing) throw new Error('Ingredient not found');
        if (data.currentQuantity?.increment !== undefined) {
          existing.currentQuantity = new Prisma.Decimal(
            existing.currentQuantity,
          ).plus(data.currentQuantity.increment);
        }
        if (data.currentQuantity?.decrement !== undefined) {
          existing.currentQuantity = new Prisma.Decimal(
            existing.currentQuantity,
          ).minus(data.currentQuantity.decrement);
        }
        if (data.version?.increment !== undefined) {
          existing.version += data.version.increment;
        }
        return { ...existing };
      },
      updateMany: async ({ where, data }: any) => {
        // Nhường event loop 1 nhịp vi mô để mô phỏng giao tranh đồng thời giữa các request Promise.all
        await Promise.resolve();
        const existing = ingredients.get(where.id);
        if (!existing) return { count: 0 };
        if (where.isActive !== undefined && existing.isActive !== where.isActive) {
          return { count: 0 };
        }
        if (where.version !== undefined && existing.version !== where.version) {
          return { count: 0 };
        }
        if (
          where.currentQuantity?.gte !== undefined &&
          new Prisma.Decimal(existing.currentQuantity).lt(where.currentQuantity.gte)
        ) {
          return { count: 0 };
        }

        if (data.currentQuantity?.decrement !== undefined) {
          existing.currentQuantity = new Prisma.Decimal(
            existing.currentQuantity,
          ).minus(data.currentQuantity.decrement);
        }
        if (data.currentQuantity?.increment !== undefined) {
          existing.currentQuantity = new Prisma.Decimal(
            existing.currentQuantity,
          ).plus(data.currentQuantity.increment);
        }
        if (data.version?.increment !== undefined) {
          existing.version += data.version.increment;
        }
        return { count: 1 };
      },
      delete: async ({ where }: any) => {
        ingredients.delete(where.id);
      },
    },

    recipe: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('rec');
        const createdItems = (data.items?.create ?? []).map((item: any) => ({
          recipeId: id,
          ingredientId: item.ingredientId,
          quantity: new Prisma.Decimal(item.quantity),
        }));
        const record = {
          id,
          productId: data.productId ?? null,
          toppingId: data.toppingId ?? null,
          size: data.size ?? null,
          isProvisional: data.isProvisional ?? false,
          items: createdItems,
        };
        recipes.set(id, record);
        return { ...record };
      },
      findFirst: async ({ where }: any) => {
        for (const rec of recipes.values()) {
          if (where.productId && rec.productId === where.productId && rec.size === where.size) {
            return {
              ...rec,
              items: rec.items.map((item: any) => ({
                ...item,
                ingredient: ingredients.get(item.ingredientId),
              })),
            };
          }
          if (where.toppingId && rec.toppingId === where.toppingId) {
            return {
              ...rec,
              items: rec.items.map((item: any) => ({
                ...item,
                ingredient: ingredients.get(item.ingredientId),
              })),
            };
          }
        }
        return null;
      },
      deleteMany: async ({ where }: any = {}) => {
        for (const [id, rec] of recipes.entries()) {
          if (!where?.productId || rec.productId === where.productId) {
            recipes.delete(id);
          }
        }
      },
    },

    user: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('usr');
        const record = {
          id,
          email: data.email,
          passwordHash: data.passwordHash,
          fullName: data.fullName ?? null,
          role: data.role ?? 'CUSTOMER',
          loyaltyPoints: data.loyaltyPoints ?? 0,
        };
        users.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        if (where.id) {
          const u = users.get(where.id);
          return u ? { ...u } : null;
        }
        if (where.email) {
          for (const u of users.values()) {
            if (u.email === where.email) return { ...u };
          }
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('User not found');
        if (data.loyaltyPoints?.increment !== undefined) {
          u.loyaltyPoints += data.loyaltyPoints.increment;
        }
        if (data.loyaltyPoints?.decrement !== undefined) {
          u.loyaltyPoints -= data.loyaltyPoints.decrement;
        }
        return { ...u };
      },
      updateMany: async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) return { count: 0 };
        if (
          where.loyaltyPoints?.gte !== undefined &&
          u.loyaltyPoints < where.loyaltyPoints.gte
        ) {
          return { count: 0 };
        }
        if (data.loyaltyPoints?.decrement !== undefined) {
          u.loyaltyPoints -= data.loyaltyPoints.decrement;
        }
        if (data.loyaltyPoints?.increment !== undefined) {
          u.loyaltyPoints += data.loyaltyPoints.increment;
        }
        return { count: 1 };
      },
      delete: async ({ where }: any) => {
        users.delete(where.id);
      },
    },

    voucher: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('vouch');
        const record = {
          id,
          code: data.code,
          discountType: data.discountType ?? 'FIXED',
          discountValue: new Prisma.Decimal(data.discountValue),
          minOrderValue:
            data.minOrderValue != null
              ? new Prisma.Decimal(data.minOrderValue)
              : null,
          maxDiscount:
            data.maxDiscount != null ? new Prisma.Decimal(data.maxDiscount) : null,
          usageLimit: data.usageLimit ?? null,
          usedCount: data.usedCount ?? 0,
          isActive: data.isActive ?? true,
        };
        vouchers.set(id, record);
        return { ...record };
      },
      findFirst: async ({ where }: any) => {
        for (const v of vouchers.values()) {
          if (where.id && v.id !== where.id) continue;
          if (where.code && v.code !== where.code) continue;
          return { ...v };
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        const v = vouchers.get(where.id);
        return v ? { ...v } : null;
      },
      update: async ({ where, data }: any) => {
        const v = vouchers.get(where.id);
        if (!v) throw new Error('Voucher not found');
        if (data.usedCount?.increment !== undefined) {
          v.usedCount += data.usedCount.increment;
        }
        return { ...v };
      },
      updateMany: async ({ where, data }: any) => {
        const v = vouchers.get(where.id);
        if (!v) return { count: 0 };
        if (where.isActive !== undefined && v.isActive !== where.isActive) {
          return { count: 0 };
        }
        if (where.usedCount?.lt !== undefined && v.usedCount >= where.usedCount.lt) {
          return { count: 0 };
        }
        if (where.usedCount?.gt !== undefined && v.usedCount <= where.usedCount.gt) {
          return { count: 0 };
        }
        if (data.usedCount?.increment !== undefined) {
          v.usedCount += data.usedCount.increment;
        }
        if (data.usedCount?.decrement !== undefined) {
          v.usedCount -= data.usedCount.decrement;
        }
        return { count: 1 };
      },
      delete: async ({ where }: any) => {
        vouchers.delete(where.id);
      },
    },

    order: {
      create: async ({ data }: any) => {
        const id = data.id || nextId('ord');
        const createdItems = (data.items?.create ?? []).map((item: any) => {
          const itemId = nextId('item');
          const usages = (item.ingredientUsages?.create ?? []).map((u: any) => ({
            id: nextId('usage'),
            orderItemId: itemId,
            ingredientId: u.ingredientId,
            quantity: new Prisma.Decimal(u.quantity),
          }));
          const itemRecord = {
            id: itemId,
            orderId: id,
            productId: item.productId,
            size: item.size,
            qty: item.qty,
            basePrice: new Prisma.Decimal(item.basePrice),
            lineTotal: new Prisma.Decimal(item.lineTotal),
            toppings: item.toppings ?? null,
            ingredientUsages: usages,
          };
          orderItems.set(itemId, itemRecord);
          return itemRecord;
        });

        const record = {
          id,
          orderNumber: data.orderNumber,
          userId: data.userId,
          status: data.status ?? 'PENDING',
          subtotal: new Prisma.Decimal(data.subtotal),
          discountAmount: new Prisma.Decimal(data.discountAmount ?? 0),
          total: new Prisma.Decimal(data.total),
          voucherId: data.voucherId ?? null,
          voucherCode: data.voucherCode ?? null,
          pointsUsed: data.pointsUsed ?? 0,
          pointsEarned: data.pointsEarned ?? 0,
          note: data.note ?? null,
          items: createdItems,
          createdAt: new Date(),
        };
        orders.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        const o = orders.get(where.id);
        return o ? { ...o } : null;
      },
      update: async ({ where, data }: any) => {
        const o = orders.get(where.id);
        if (!o) throw new Error('Order not found');
        if (data.status !== undefined) o.status = data.status;
        if (data.pointsEarned !== undefined) o.pointsEarned = data.pointsEarned;
        return { ...o };
      },
      updateMany: async ({ where, data }: any) => {
        const o = orders.get(where.id);
        if (!o) return { count: 0 };
        if (where.status !== undefined && o.status !== where.status) {
          return { count: 0 };
        }
        if (data.status !== undefined) o.status = data.status;
        if (data.pointsEarned !== undefined) o.pointsEarned = data.pointsEarned;
        return { count: 1 };
      },
      delete: async ({ where }: any) => {
        orders.delete(where.id);
      },
      deleteMany: async ({ where }: any = {}) => {
        if (where?.id?.in) {
          for (const id of where.id.in) orders.delete(id);
        }
      },
    },

    orderItem: {
      findMany: async ({ where }: any) => {
        return [...orderItems.values()]
          .filter((item) => item.orderId === where.orderId)
          .map((item) => ({ ...item }));
      },
    },

    payment: {
      create: async ({ data }: any) => {
        for (const p of payments.values()) {
          if (p.idempotencyKey === data.idempotencyKey) {
            throw new Error('Unique constraint failed on idempotencyKey');
          }
        }
        const id = data.id || nextId('pay');
        const record = {
          id,
          orderId: data.orderId,
          idempotencyKey: data.idempotencyKey,
          amount: new Prisma.Decimal(data.amount),
          method: data.method,
          status: data.status,
          transactionId: data.transactionId ?? null,
          createdAt: new Date(),
        };
        payments.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        if (where.idempotencyKey) {
          for (const p of payments.values()) {
            if (p.idempotencyKey === where.idempotencyKey) return { ...p };
          }
        }
        if (where.id) {
          const p = payments.get(where.id);
          return p ? { ...p } : null;
        }
        return null;
      },
      count: async ({ where }: any = {}) => {
        return [...payments.values()].filter((p) => {
          if (where.idempotencyKey && p.idempotencyKey !== where.idempotencyKey)
            return false;
          if (where.orderId && p.orderId !== where.orderId) return false;
          return true;
        }).length;
      },
      deleteMany: async () => {
        payments.clear();
      },
    },

    inventoryMovement: {
      findFirst: async ({ where }: any) => {
        for (const m of inventoryMovements.values()) {
          if (where.orderId && m.orderId !== where.orderId) continue;
          if (where.ingredientId && m.ingredientId !== where.ingredientId) continue;
          if (where.type && m.type !== where.type) continue;
          return { ...m };
        }
        return null;
      },
      findMany: async ({ where }: any = {}) => {
        return [...inventoryMovements.values()].filter((m) => {
          if (where.orderId && m.orderId !== where.orderId) return false;
          if (where.type && m.type !== where.type) return false;
          return true;
        });
      },
      create: async ({ data }: any) => {
        const id = nextId('mov');
        const record = {
          id,
          ingredientId: data.ingredientId,
          orderId: data.orderId ?? null,
          actorId: data.actorId ?? null,
          type: data.type,
          quantityDelta: new Prisma.Decimal(data.quantityDelta),
          note: data.note ?? null,
          createdAt: new Date(),
        };
        inventoryMovements.set(id, record);
        return { ...record };
      },
      count: async ({ where }: any = {}) => {
        return [...inventoryMovements.values()].filter((m) => {
          if (where.ingredientId && m.ingredientId !== where.ingredientId)
            return false;
          if (where.orderId && m.orderId !== where.orderId) return false;
          if (where.type && m.type !== where.type) return false;
          return true;
        }).length;
      },
      deleteMany: async () => {
        inventoryMovements.clear();
      },
    },

    topping: {
      findMany: async () => [...toppings.values()],
    },
  };

  return client;
}
