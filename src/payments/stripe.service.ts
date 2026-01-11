import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
      // Create dummy stripe instance for development
      this.stripe = null;
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-12-18.acacia',
      });
      this.logger.log('✅ Stripe Service initialized');
    }
  }

  /**
   * Create a PaymentIntent (authorize payment)
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'eur',
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount, // Amount in cents
        currency,
        capture_method: 'manual', // Authorize now, capture later
        metadata: metadata || {},
      });

      this.logger.log(`PaymentIntent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create PaymentIntent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Capture a previously authorized payment
   */
  async capturePayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const captured = await this.stripe.paymentIntents.capture(
        paymentIntentId,
      );

      this.logger.log(`Payment captured: ${paymentIntentId}`);
      return captured;
    } catch (error) {
      this.logger.error(`Failed to capture payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a PaymentIntent
   */
  async cancelPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const cancelled = await this.stripe.paymentIntents.cancel(
        paymentIntentId,
      );

      this.logger.log(`Payment cancelled: ${paymentIntentId}`);
      return cancelled;
    } catch (error) {
      this.logger.error(`Failed to cancel payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PaymentIntent details
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Failed to retrieve PaymentIntent: ${error.message}`);
      throw error;
    }
  }
}
