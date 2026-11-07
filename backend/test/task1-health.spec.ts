import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('Task 1: Project Setup & Health Check Endpoints', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('1. GET /hello trả về thông điệp chào mừng từ BrewLite Backend', () => {
    const result = appController.getHello();
    expect(result).toBeDefined();
    expect(JSON.stringify(result)).toContain('BrewLite');
  });

  it('2. GET /health trả về trạng thái hoạt động ok', () => {
    const health = appController.getHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('BrewLite Backend');
    expect(health.timestamp).toBeDefined();
  });
});

