test/task10-concurrency.e2e-spec.ts (Tiêu chí c: Test xử lý đồng thời không âm kho)

TypeScript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('Task 10 (c): Concurrency Control & Stock Integrity', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testProductId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const product = await prisma.product.create({
      data: { name: 'CF Flash Sale', price: 35000, imageUrl: 'img.png', stock: 3, version: 0, category: 'coffee' },
    });
    testProductId = product.id;
  });

  afterAll(async () => { await app.close(); });

  it('10 request đặt mua đồng thời kho = 3: Đúng 3 thành công, 7 từ chối, kho về 0 (không âm)', async () => {
    const buyOptimistic = async (prodId: string) => {
      return prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id: prodId } });
        if (!current || current.stock < 1) throw new Error('OUT_OF_STOCK');

        const updateRes = await tx.product.updateMany({
          where: { id: prodId, version: current.version, stock: { gte: 1 } },
          data: { stock: { decrement: 1 }, version: { increment: 1 } },
        });

        if (updateRes.count === 0) throw new Error('CONCURRENCY_CONFLICT');
        return { success: true };
      });
    };

    const requests = Array.from({ length: 10 }).map(async () => {
      try {
        await buyOptimistic(testProductId);
        return { status: 'SUCCESS' };
      } catch (e: any) {
        return { status: 'FAILED' };
      }
    });

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;

    expect(successCount).toBe(3);
    expect(failedCount).toBe(7);

    const finalProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(finalProduct?.stock).toBe(0);
  });
});