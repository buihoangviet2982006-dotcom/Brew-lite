import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('vietqr/:orderId')
  async getVietQR(
    @Param('orderId') orderId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.generateVietQR(orderId, user.id);
  }

  @Get('status/:orderId')
  async getPaymentStatus(
    @Param('orderId') orderId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.checkPaymentStatus(orderId, user.id);
  }

  @Post()
  async directPayment(
    @Headers('idempotency-key') headerKey: string,
    @Headers('Idempotency-Key') capitalizedKey: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    const idempotencyKey = headerKey || capitalizedKey;
    return this.paymentsService.processDirectPayment(dto, idempotencyKey, user.id);
  }

  @Post('sepay-webhook')
  async handleSepayWebhook(
    @Body() payload: any,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handleSepayWebhook(payload, authHeader);
  }

  @Post('simulate-sepay')
  async simulateSepay(
    @Body('orderId') orderId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.simulateSepayTransfer(orderId, user.id);
  }
}