import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

describe('Task 10 (b): Idempotent Payment Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sampleOrderId: string;
  let sampleUserId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `test_${Date.now()}@sgu.edu.vn`, passwordHash: 'hash', fullName: 'Tester' },
    });
    sampleUserId = user.id;

    const order = await prisma.order.create({
      data: { userId: sampleUserId, status: OrderStatus.PENDING, subtotal: 50000, total: 50000 },
    });
    sampleOrderId = order.id;
  });

  afterAll(async () => { await app.close(); });

  it('Gửi 2 lần cùng Idempotency-Key: Request 2 trả kết quả cũ, DB chỉ lưu 1 bản ghi', async () => {
    const key = `KEY_${Date.now()}`;
    const payload = { orderId: sampleOrderId, amount: 50000, method: 'WALLET' };

    await request(app.getHttpServer()).post('/payments').set('Idempotency-Key', key).send(payload).expect(201);
    const res2 = await request(app.getHttpServer()).post('/payments').set('Idempotency-Key', key).send(payload);

    expect(res2.body.isIdempotentReplay).toBe(true);
    const count = await prisma.payment.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });
});