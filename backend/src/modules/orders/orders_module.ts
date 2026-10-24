import { Module } from '@nestjs/common';
import { OrdersController } from './orders_controller';
import { OrdersService } from './orders_service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // Export OrdersService để sau này module Payments (Task 8) có thể dùng lại
})
export class OrdersModule {}