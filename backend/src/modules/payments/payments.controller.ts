import { Body, Controller, Get, Headers, Param, Post, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Controller('payments')
@UseGuards(AuthGuard('jwt')) // Yêu cầu đăng nhập cho mọi thao tác thanh toán
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('vietqr/:orderId')
  async getVietQR(
    @Param('orderId') orderId: string,
    @Req() req: any
  ) {
    // req.user.id lấy từ payload JWT sau khi Guard xác thực thành công
    return this.paymentsService.generateVietQR(orderId, req.user.id);
  }

  @Post()
  async directPayment(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: any
  ) {
    return this.paymentsService.processDirectPayment(dto, idempotencyKey, req.user.id);
  }
}