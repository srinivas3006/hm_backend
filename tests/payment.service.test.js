jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const paymentService = require('../src/services/paymentService');
const paymentRepository = require('../src/repositories/paymentRepository');
const Payment = require('../src/models/Payment');
const logger = require('../src/utils/logger');

const {
  PAYMENT_STATUS,
  InvalidPaymentTransitionError,
  PaymentOwnershipError,
  PaymentExpiredError,
  PaymentAlreadyVerifiedError,
  DuplicateUTRError,
  PaymentCreationNotAllowedError
} = require('../src/services/paymentService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('PaymentService', () => {
  let replSet;
  let orderId;
  let userId;
  let adminId;

  const basePayment = (overrides = {}) => ({
    order: orderId,
    user: userId,
    amount: 499,
    ...overrides
  });

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    await mongoose.connect(replSet.getUri());
    await Payment.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    orderId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();
    jest.clearAllMocks();
    await Payment.deleteMany({});
  });

  it('creates a manual payment with UPI defaults', async () => {
    const payment = await paymentService.createManualPayment(basePayment());

    expect(payment.provider).toBe('manual_upi');
    expect(payment.paymentMethod).toBe('UPI');
    expect(payment.status).toBe(PAYMENT_STATUS.INTENT_CREATED);
    expect(logger.info).toHaveBeenCalledWith('payment.created', expect.objectContaining({
      provider: 'manual_upi'
    }));
  });

  it('creates a gateway payment without hardcoding providers', async () => {
    const payment = await paymentService.createGatewayPayment(basePayment({
      provider: 'FutureGateway',
      paymentMethod: 'CARD',
      providerOrderId: 'order_123'
    }));

    expect(payment.provider).toBe('futuregateway');
    expect(payment.paymentMethod).toBe('CARD');
  });

  it('requires provider for gateway payments', async () => {
    await expect(paymentService.createGatewayPayment(basePayment()))
      .rejects.toBeInstanceOf(PaymentCreationNotAllowedError);
  });

  it('prevents duplicate UTR submission', async () => {
    await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.PAYMENT_SUBMITTED,
      utr: 'UTR123456789'
    }));
    const payment = await paymentService.createManualPayment(basePayment({
      order: new mongoose.Types.ObjectId(),
      status: PAYMENT_STATUS.PAYMENT_PENDING,
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    await expect(paymentService.submitManualUTR(payment._id, 'UTR123456789', {
      userId: payment.user,
      orderId: payment.order
    })).rejects.toBeInstanceOf(DuplicateUTRError);

    expect(logger.warn).toHaveBeenCalledWith('payment.duplicate_utr', expect.objectContaining({
      maskedUtr: expect.stringMatching(/\*+6789$/)
    }));
  });

  it('allows multiple failed attempts for one order', async () => {
    await paymentService.createManualPayment(basePayment({ status: PAYMENT_STATUS.PAYMENT_FAILED }));
    await paymentService.createManualPayment(basePayment({ status: PAYMENT_STATUS.PAYMENT_PENDING }));

    const attempts = await paymentService.listPaymentAttempts(orderId);

    expect(attempts.pagination.total).toBe(2);
  });

  it('blocks a new payment attempt when an order already has a successful payment', async () => {
    await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.PAYMENT_VERIFIED,
      utr: 'UTR123456789'
    }));

    await expect(paymentService.createManualPayment(basePayment({
      order: orderId,
      status: PAYMENT_STATUS.PAYMENT_PENDING
    }))).rejects.toBeInstanceOf(PaymentCreationNotAllowedError);
  });

  it('validates invalid state transitions centrally', () => {
    expect(() => paymentService.validatePaymentTransition(
      PAYMENT_STATUS.PAYMENT_VERIFIED,
      PAYMENT_STATUS.PAYMENT_PENDING
    )).toThrow(InvalidPaymentTransitionError);
  });

  it('submits a manual UTR from pending payment state', async () => {
    const payment = await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.PAYMENT_PENDING,
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    const updated = await paymentService.submitManualUTR(payment._id, 'UTR123456789', {
      userId,
      orderId
    });

    expect(updated.status).toBe(PAYMENT_STATUS.VERIFICATION_PENDING);
    expect(updated.utr).toBe('UTR123456789');
    expect(logger.info).toHaveBeenCalledWith('payment.utr_submitted', expect.objectContaining({
      maskedUtr: expect.stringMatching(/\*+6789$/)
    }));
  });

  it('verifies a submitted manual payment', async () => {
    const payment = await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.PAYMENT_SUBMITTED,
      utr: 'UTR123456789',
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    const updated = await paymentService.verifyManualPayment(payment._id, { userId: adminId });

    expect(updated.status).toBe(PAYMENT_STATUS.PAYMENT_VERIFIED);
    expect(updated.verifiedBy.toString()).toBe(adminId.toString());
  });

  it('rejects manual payment verification', async () => {
    const payment = await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789',
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    const updated = await paymentService.rejectManualPayment(payment._id, { userId: adminId }, {
      reason: 'UTR not found in bank statement'
    });

    expect(updated.status).toBe(PAYMENT_STATUS.PAYMENT_REJECTED);
    expect(updated.failureReason).toBe('UTR not found in bank statement');
  });

  it('prevents verification of expired payments', async () => {
    const payment = await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789',
      activeIntent: true,
      expiresAt: new Date(Date.now() - 1000)
    }));

    await expect(paymentService.verifyManualPayment(payment._id, { userId: adminId }))
      .rejects.toBeInstanceOf(PaymentExpiredError);
  });

  it('validates payment ownership', async () => {
    const payment = await paymentService.createManualPayment(basePayment());

    expect(() => paymentService.validatePaymentOwnership(payment, {
      userId: new mongoose.Types.ObjectId()
    })).toThrow(PaymentOwnershipError);
  });

  it('maps repository duplicate successful payment errors to service errors', async () => {
    await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.PAYMENT_VERIFIED,
      utr: 'UTR123456789'
    }));

    const secondPayment = await paymentRepository.create({
      order: orderId,
      user: userId,
      amount: 499,
      status: PAYMENT_STATUS.PAYMENT_PENDING
    });

    await expect(paymentService.markPaymentSuccessful(secondPayment._id, { userId: adminId }))
      .rejects.toBeInstanceOf(PaymentAlreadyVerifiedError);
  });

  it('supports successful writes inside an external transaction', async () => {
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      await paymentService.createManualPayment(basePayment(), { session });
    });

    await session.endSession();

    const attempts = await paymentService.getPaymentByOrder(orderId);
    expect(attempts).toHaveLength(1);
  });

  it('rolls back service writes when an external transaction aborts', async () => {
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await paymentService.createManualPayment(basePayment(), { session });
      throw new Error('abort transaction');
    })).rejects.toThrow('abort transaction');

    await session.endSession();

    const attempts = await paymentService.getPaymentByOrder(orderId);
    expect(attempts).toHaveLength(0);
  });

  it('handles practical concurrent verification attempts on the same payment', async () => {
    const payment = await paymentService.createManualPayment(basePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789',
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    const results = await Promise.allSettled([
      paymentService.verifyManualPayment(payment._id, { userId: adminId }),
      paymentService.verifyManualPayment(payment._id, { userId: adminId })
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('prevents creating payment attempts for terminal order statuses passed by callers', async () => {
    await expect(paymentService.createManualPayment(basePayment(), { orderStatus: 'CANCELLED' }))
      .rejects.toBeInstanceOf(PaymentCreationNotAllowedError);
  });

  it('finds active payments through the repository only', async () => {
    const payment = await paymentService.createPaymentIntent(basePayment(), { orderAmount: 499 });

    const active = await paymentService.findActivePayment(orderId);

    expect(active._id.toString()).toBe(payment._id.toString());
  });
});
