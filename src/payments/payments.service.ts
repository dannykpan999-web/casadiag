import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StripeService } from './stripe.service';

const PACK_PRICES = {
  orientacion: 0, // Free
  informe: 4900, // 49€ in cents
  prioridad: 8900, // 89€ in cents
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  /**
   * Create a PaymentIntent for a case
   */
  async createPaymentIntent(caseId: string, packId: string) {
    // Verify case exists
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    // Get pack price
    const amount = PACK_PRICES[packId];
    if (amount === undefined) {
      throw new BadRequestException(`Invalid pack ID: ${packId}`);
    }

    if (amount === 0) {
      throw new BadRequestException(
        'Free pack does not require payment',
      );
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await this.stripeService.createPaymentIntent(
      amount,
      'eur',
      {
        caseId,
        packId,
        userProfile: caseData.userProfile,
      },
    );

    // Save payment record
    const payment = await this.prisma.payment.create({
      data: {
        caseId,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency: 'eur',
        packId,
        status: 'pending',
      },
    });

    this.logger.log(`PaymentIntent created for case ${caseId}`);

    return {
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
      amount,
      currency: 'eur',
    };
  }

  /**
   * Authorize payment (after frontend confirms with Stripe)
   */
  async authorizePayment(caseId: string, paymentIntentId: string) {
    // Find payment record
    const payment = await this.prisma.payment.findFirst({
      where: {
        caseId,
        stripePaymentIntentId: paymentIntentId,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify payment status with Stripe
    const paymentIntent = await this.stripeService.getPaymentIntent(
      paymentIntentId,
    );

    if (paymentIntent.status !== 'requires_capture') {
      throw new BadRequestException(
        `Payment status is ${paymentIntent.status}, expected requires_capture`,
      );
    }

    // Update payment record
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'authorized',
        authorizedAt: new Date(),
      },
    });

    // Update case state to S6_REVISION_HUMANA
    await this.prisma.case.update({
      where: { id: caseId },
      data: { currentState: 'S6_REVISION_HUMANA' },
    });

    this.logger.log(`Payment authorized for case ${caseId}`);

    return {
      success: true,
      paymentId: updatedPayment.id,
      status: 'authorized',
    };
  }

  /**
   * Capture payment (when report is delivered)
   */
  async capturePayment(caseId: string) {
    // Find authorized payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        caseId,
        status: 'authorized',
      },
    });

    if (!payment) {
      throw new NotFoundException(
        'No authorized payment found for this case',
      );
    }

    // Capture via Stripe
    const captured = await this.stripeService.capturePayment(
      payment.stripePaymentIntentId,
    );

    // Update payment record
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'captured',
        capturedAt: new Date(),
      },
    });

    this.logger.log(`Payment captured for case ${caseId}: ${payment.amount / 100}€`);

    return {
      success: true,
      paymentId: updatedPayment.id,
      amount: payment.amount,
      status: 'captured',
    };
  }

  /**
   * Cancel payment (refund if authorized)
   */
  async cancelPayment(caseId: string, reason?: string) {
    // Find payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        caseId,
        status: { in: ['pending', 'authorized'] },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        'No cancellable payment found for this case',
      );
    }

    // Cancel via Stripe
    await this.stripeService.cancelPayment(payment.stripePaymentIntentId);

    // Update payment record
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    this.logger.log(`Payment cancelled for case ${caseId}`);

    return {
      success: true,
      paymentId: updatedPayment.id,
      status: 'cancelled',
      reason,
    };
  }

  /**
   * Get payment status for a case
   */
  async getPaymentStatus(caseId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { hasPayment: false };
    }

    return {
      hasPayment: true,
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      packId: payment.packId,
      authorizedAt: payment.authorizedAt,
      capturedAt: payment.capturedAt,
      cancelledAt: payment.cancelledAt,
    };
  }
}
