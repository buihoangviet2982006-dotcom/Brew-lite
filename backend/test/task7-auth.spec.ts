import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';

describe('Task 7: Authentication & JWT Guard (POST /auth/register, POST /auth/login)', () => {
  let controller: AuthController;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked.jwt.token'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. POST /auth/register băm mật khẩu bằng bcrypt và trả về JWT token', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.user.create.mockImplementation(async ({ data }) => ({
      id: 'usr-new-01',
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      role: UserRole.CUSTOMER,
      loyaltyPoints: 0,
    }));

    const res = await controller.register({
      email: 'NewUser@BrewLite.vn',
      password: 'password123',
      fullName: 'Nguyễn Văn B',
    });

    expect(res.token).toBe('mocked.jwt.token');
    expect(res.user.email).toBe('newuser@brewlite.vn');

    const createdArg = mockPrismaService.user.create.mock.calls[0][0].data;
    expect(createdArg.passwordHash).not.toBe('password123');
    const isMatched = await bcrypt.compare('password123', createdArg.passwordHash);
    expect(isMatched).toBe(true);
  });

  it('2. POST /auth/register chặn đăng ký trùng email (ConflictException)', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'usr-existing',
      email: 'existing@brewlite.vn',
    });

    await expect(
      controller.register({
        email: 'existing@brewlite.vn',
        password: 'password123',
        fullName: 'Người Dùng Cũ',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. POST /auth/login xác thực mật khẩu đã băm và phát hành JWT', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'usr-demo-01',
      email: 'customer@brewlite.vn',
      fullName: 'Khách Hàng',
      passwordHash,
      role: UserRole.CUSTOMER,
      loyaltyPoints: 120,
    });

    const res = await controller.login({
      email: 'customer@brewlite.vn',
      password: 'password123',
    });

    expect(res.token).toBe('mocked.jwt.token');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'usr-demo-01',
        email: 'customer@brewlite.vn',
      }),
    );
  });

  it('4. POST /auth/login từ chối khi sai mật khẩu (UnauthorizedException)', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 'usr-demo-01',
      email: 'customer@brewlite.vn',
      passwordHash,
    });

    await expect(
      controller.login({
        email: 'customer@brewlite.vn',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('5. JwtAuthGuard được gắn bảo vệ trên OrdersController.createOrder', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../src/modules/orders/orders_controller').OrdersController.prototype
        .createOrder,
    );
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
  });
});

