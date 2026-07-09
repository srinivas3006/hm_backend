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
  PaymentCreationNotAllowedError,
  PaymentExpiredError,
  PaymentIntentAmountMismatchError,
  PaymentIntentInactiveError,
  InvalidPaymentTransitionError
} = require('../src/services/paymentService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Payment Intent lifecycle', () => {
  let replSet;
  let orderId;
  let userId;

  const intentData = (overrides = {}) => ({
    order: orderId,
    user: userId,
    amount: 999,
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
    jest.clearAllMocks();
    await Payment.deleteMany({});
  });

  it('creates an active payment intent with locked amount and default expiry', async () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const intent = await paymentService.createPaymentIntent(intentData(), {
      orderAmount: 999,
      now
    });

    expect(intent.status).toBe(PAYMENT_STATUS.INTENT_CREATED);
    expect(intent.activeIntent).toBe(true);
    expect(intent.amount).toBe(999);
    expect(intent.expiresAt.toISOString()).toBe('2026-07-08T10:15:00.000Z');
    expect(logger.info).toHaveBeenCalledWith('payment_intent.created', expect.objectContaining({
      order: orderId.toString()
    }));
  });

  it('expires the previous active intent before creating a replacement', async () => {
    const first = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });
    const second = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });

    const reloadedFirst = await paymentRepository.getById(first._id);
    const active = await paymentService.getActivePaymentIntent(orderId);

    expect(reloadedFirst.status).toBe(PAYMENT_STATUS.PAYMENT_EXPIRED);
    expect(reloadedFirst.activeIntent).toBe(false);
    expect(active._id.toString()).toBe(second._id.toString());
  });

  it('rejects intent creation when amount does not match order amount', async () => {
    await expect(paymentService.createPaymentIntent(intentData({ amount: 998 }), {
      orderAmount: 999
    })).rejects.toBeInstanceOf(PaymentIntentAmountMismatchError);
  });

  it('rejects intent creation for cancelled orders passed by future callers', async () => {
    await expect(paymentService.createPaymentIntent(intentData(), {
      orderAmount: 999,
      orderStatus: 'CANCELLED'
    })).rejects.toBeInstanceOf(PaymentCreationNotAllowedError);
  });

  it('rejects intent creation when a successful payment already exists', async () => {
    await paymentService.createManualPayment(intentData({
      status: PAYMENT_STATUS.PAYMENT_VERIFIED,
      utr: 'UTR123456789'
    }));

    await expect(paymentService.createPaymentIntent(intentData(), {
      orderAmount: 999
    })).rejects.toBeInstanceOf(PaymentCreationNotAllowedError);
  });

  it('validates active intent ownership and amount', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });

    expect(paymentService.validateIntent(intent, {
      orderId,
      userId,
      amount: 999
    })).toBe(true);
  });

  it('rejects validation for inactive intents', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });
    const cancelled = await paymentService.cancelIntent(intent._id, { userId }, { orderId, userId });

    expect(() => paymentService.validateIntent(cancelled, {
      orderId,
      userId,
      amount: 999
    })).toThrow(PaymentIntentInactiveError);
  });

  it('rejects validation for expired intents', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), {
      orderAmount: 999,
      expiresAt: new Date(Date.now() - 1000)
    });

    expect(() => paymentService.validateIntent(intent, {
      orderId,
      userId
    })).toThrow(PaymentExpiredError);
  });

  it('cancels an active intent', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });
    const cancelled = await paymentService.cancelIntent(intent._id, { userId }, { orderId, userId });

    expect(cancelled.status).toBe(PAYMENT_STATUS.PAYMENT_CANCELLED);
    expect(cancelled.activeIntent).toBe(false);
    expect(logger.info).toHaveBeenCalledWith('payment_intent.cancelled', expect.objectContaining({
      paymentId: intent._id.toString()
    }));
  });

  it('expires an active intent by id', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 999 });
    const expired = await paymentService.expirePaymentIntent(intent._id);

    expect(expired.status).toBe(PAYMENT_STATUS.PAYMENT_EXPIRED);
    expect(expired.activeIntent).toBe(false);
  });

  it('finds expired active intents for cleanup workflows', async () => {
    await paymentRepository.createIntent(intentData({
      expiresAt: new Date(Date.now() - 1000)
    }));
    await paymentRepository.createIntent(intentData({
      order: new mongoose.Types.ObjectId(),
      expiresAt: new Date(Date.now() + 60000)
    }));

    const result = await paymentRepository.findExpiredIntents(new Date());

    expect(result.pagination.total).toBe(1);
  });

  it('supports transaction rollback for intent creation', async () => {
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await paymentService.createPaymentIntent(intentData(), { orderAmount: 999, session });
      throw new Error('abort intent transaction');
    })).rejects.toThrow('abort intent transaction');

    await session.endSession();

    const active = await paymentService.getActivePaymentIntent(orderId);
    expect(active).toBeNull();
  });

  it('allows only one active intent under practical concurrent creation', async () => {
    const results = await Promise.allSettled([
      paymentService.createPaymentIntent(intentData(), { orderAmount: 999 }),
      paymentService.createPaymentIntent(intentData(), { orderAmount: 999 })
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    const active = await paymentService.getActivePaymentIntent(orderId);

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(PaymentCreationNotAllowedError);
    expect(active._id.toString()).toBe(fulfilled[0].value._id.toString());
  });

  it('keeps QR generation transition scaffolded without generating QR codes', () => {
    expect(paymentService.validatePaymentTransition(
      PAYMENT_STATUS.INTENT_CREATED,
      PAYMENT_STATUS.QR_PENDING
    )).toBe(true);

    expect(() => paymentService.validatePaymentTransition(
      PAYMENT_STATUS.INTENT_CREATED,
      PAYMENT_STATUS.PAYMENT_VERIFIED
    )).toThrow(InvalidPaymentTransitionError);
  });
});
