import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, SePayWebhookDto } from './dto/payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('vietqr/:orderId')
  async getVietQR(@Param('orderId') orderId: string) {
    return this.paymentsService.generateVietQR(orderId);
  }

  @Post('sepay-webhook')
  async handleWebhook(
    @Body() payload: SePayWebhookDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.paymentsService.handleSePayWebhook(payload, authHeader);
  }

  @Post()
  async directPayment(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.processDirectPayment(dto, idempotencyKey);
  }
}