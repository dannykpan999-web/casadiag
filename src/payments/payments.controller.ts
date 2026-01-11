import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('api/cases/:caseId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @ApiOperation({ summary: 'Create a PaymentIntent for a case' })
  @ApiResponse({ status: 201, description: 'PaymentIntent created' })
  async createIntent(
    @Param('caseId') caseId: string,
    @Body() body: { packId: string },
  ) {
    return this.paymentsService.createPaymentIntent(caseId, body.packId);
  }

  @Post('authorize')
  @ApiOperation({ summary: 'Authorize payment after frontend confirmation' })
  @ApiResponse({ status: 200, description: 'Payment authorized' })
  async authorize(
    @Param('caseId') caseId: string,
    @Body() body: { paymentIntentId: string },
  ) {
    return this.paymentsService.authorizePayment(caseId, body.paymentIntentId);
  }

  @Post('capture')
  @ApiOperation({ summary: 'Capture authorized payment (admin only)' })
  @ApiResponse({ status: 200, description: 'Payment captured' })
  async capture(@Param('caseId') caseId: string) {
    return this.paymentsService.capturePayment(caseId);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel payment' })
  @ApiResponse({ status: 200, description: 'Payment cancelled' })
  async cancel(
    @Param('caseId') caseId: string,
    @Body() body: { reason?: string },
  ) {
    return this.paymentsService.cancelPayment(caseId, body.reason);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get payment status for a case' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  async getStatus(@Param('caseId') caseId: string) {
    return this.paymentsService.getPaymentStatus(caseId);
  }
}
