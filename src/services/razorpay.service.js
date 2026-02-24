import Razorpay from 'razorpay';
import crypto from 'crypto';
import { environmentConfig } from '../config/environment.js';
import { logger } from '../common/logger.js';

class RazorpayService {
  constructor() {
    this.instance = null;
  }

  /**
   * Initialize the Razorpay instance with keys from config.
   * Lazily creates the instance on first use.
   */
  initialize() {
    if (this.instance) return this.instance;

    const { keyId, keySecret } = environmentConfig.razorpay;

    if (!keyId || !keySecret) {
      throw new Error(
        'Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'
      );
    }

    this.instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    logger.info('Razorpay SDK initialized');
    return this.instance;
  }

  /**
   * Get the Razorpay key ID (public key for frontend).
   */
  getKeyId() {
    return environmentConfig.razorpay.keyId;
  }

  /**
   * Create a Razorpay order for payment collection.
   * @param {number} amount - Amount in the smallest currency unit (paise for INR)
   * @param {string} currency - Currency code (e.g. 'INR')
   * @param {string} receipt - Unique receipt identifier
   * @param {object} notes - Optional metadata
   * @returns {Promise<object>} Razorpay order object
   */
  async createOrder(amount, currency = 'INR', receipt = '', notes = {}) {
    const razorpay = this.initialize();

    const order = await razorpay.orders.create({
      amount: Math.round(amount), // Must be integer (paise)
      currency,
      receipt,
      notes,
    });

    logger.info({ orderId: order.id, amount, currency }, 'Razorpay order created');
    return order;
  }

  /**
   * Verify the payment signature from Razorpay callback/checkout.
   * Uses HMAC SHA256 with the Razorpay key secret.
   * @param {string} orderId - Razorpay order ID
   * @param {string} paymentId - Razorpay payment ID
   * @param {string} signature - Signature from Razorpay callback
   * @returns {boolean} Whether the signature is valid
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    const { keySecret } = environmentConfig.razorpay;

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );

    if (!isValid) {
      logger.warn({ orderId, paymentId }, 'Razorpay payment signature verification failed');
    }

    return isValid;
  }

  /**
   * Verify webhook signature from Razorpay.
   * @param {string|Buffer} body - Raw request body
   * @param {string} signature - X-Razorpay-Signature header
   * @returns {boolean} Whether the webhook signature is valid
   */
  verifyWebhookSignature(body, signature) {
    const { webhookSecret } = environmentConfig.razorpay;

    if (!webhookSecret) {
      logger.warn('Razorpay webhook secret not configured, skipping signature verification');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay.
   * @param {string} paymentId - Razorpay payment ID
   * @returns {Promise<object>} Payment details
   */
  async fetchPayment(paymentId) {
    const razorpay = this.initialize();
    return razorpay.payments.fetch(paymentId);
  }

  /**
   * Create a Razorpay subscription (for recurring billing).
   * @param {string} planId - Razorpay plan ID
   * @param {string} customerId - Razorpay customer ID (optional)
   * @param {object} options - Additional subscription options
   * @returns {Promise<object>} Razorpay subscription object
   */
  async createSubscription(planId, customerId = null, options = {}) {
    const razorpay = this.initialize();

    const subscriptionData = {
      plan_id: planId,
      total_count: options.totalCount || 12, // Default 12 billing cycles
      quantity: options.quantity || 1,
      ...(customerId && { customer_id: customerId }),
      ...(options.startAt && { start_at: options.startAt }),
      ...(options.notes && { notes: options.notes }),
    };

    const subscription = await razorpay.subscriptions.create(subscriptionData);

    logger.info({ subscriptionId: subscription.id, planId }, 'Razorpay subscription created');
    return subscription;
  }

  /**
   * Cancel a Razorpay subscription.
   * @param {string} subscriptionId - Razorpay subscription ID
   * @param {boolean} cancelAtCycleEnd - Cancel at end of current billing cycle
   * @returns {Promise<object>} Cancelled subscription
   */
  async cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
    const razorpay = this.initialize();

    const result = await razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);

    logger.info({ subscriptionId }, 'Razorpay subscription cancelled');
    return result;
  }

  /**
   * Create a Razorpay customer.
   * @param {object} data - Customer details (name, email, contact)
   * @returns {Promise<object>} Razorpay customer object
   */
  async createCustomer(data) {
    const razorpay = this.initialize();

    return razorpay.customers.create({
      name: data.name,
      email: data.email,
      contact: data.phone || undefined,
      notes: data.notes || {},
    });
  }

  /**
   * Fetch a refund for a payment.
   * @param {string} paymentId - Razorpay payment ID
   * @param {number} amount - Amount to refund in smallest currency unit
   * @returns {Promise<object>} Refund object
   */
  async refundPayment(paymentId, amount) {
    const razorpay = this.initialize();

    return razorpay.payments.refund(paymentId, {
      amount: Math.round(amount),
    });
  }
}

export const razorpayService = new RazorpayService();
