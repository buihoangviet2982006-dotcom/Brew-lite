import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders_service';
import { CreateOrderDto } from './dto/create_order_dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('orders')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.create(createOrderDto, user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyOrders(@CurrentUser() user: { id: string }) {
    return this.ordersService.findMyOrders(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getOrderById(
    @Param('id') orderId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.findOrderById(orderId, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body('status') newStatus: OrderStatus,
    @CurrentUser() user: { id: string; role?: string },
  ) {
    return this.ordersService.updateStatus(orderId, newStatus, user);
  }
}