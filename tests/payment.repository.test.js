const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const paymentRepository = require('../src/repositories/paymentRepository');
const Payment = require('../src/models/Payment');

const {
  InvalidPaymentIdError,
  PaymentNotFoundError,
  DuplicatePaymentReferenceError,
  DuplicateSuccessfulPaymentError
} = require('../src/repositories/paymentRepository');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('PaymentRepository', () => {
  let replSet;
  let orderId;
  let userId;

  const createPaymentData = (overrides = {}) => ({
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
    await Payment.deleteMany({});
  });

  it('creates a payment', async () => {
    const payment = await paymentRepository.create(createPaymentData());

    expect(payment._id).toBeDefined();
    expect(payment.order.toString()).toBe(orderId.toString());
    expect(payment.user.toString()).toBe(userId.toString());
  });

  it('maps duplicate UTR errors to repository exceptions', async () => {
    await paymentRepository.create(createPaymentData({ utr: 'UTR123456789', status: 'SUBMITTED' }));

    await expect(paymentRepository.create(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      utr: 'UTR123456789',
      status: 'SUBMITTED'
    }))).rejects.toBeInstanceOf(DuplicatePaymentReferenceError);
  });

  it('allows multiple non-successful attempts for one order', async () => {
    await paymentRepository.create(createPaymentData({ status: 'FAILED', attemptNumber: 1 }));
    await paymentRepository.create(createPaymentData({ status: 'PENDING', attemptNumber: 2 }));

    const result = await paymentRepository.listPaymentAttempts(orderId);

    expect(result.pagination.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('allows only one successful payment per order', async () => {
    await paymentRepository.create(createPaymentData({ status: 'VERIFIED', utr: 'UTR123456789' }));

    await expect(paymentRepository.create(createPaymentData({
      status: 'VERIFIED',
      utr: 'UTR987654321'
    }))).rejects.toBeInstanceOf(DuplicateSuccessfulPaymentError);
  });

  it('throws invalid id errors before querying', async () => {
    await expect(paymentRepository.findById('not-an-id')).rejects.toBeInstanceOf(InvalidPaymentIdError);
    await expect(paymentRepository.findByOrder('not-an-id')).rejects.toBeInstanceOf(InvalidPaymentIdError);
  });

  it('throws not found when a required payment is missing', async () => {
    await expect(paymentRepository.getById(new mongoose.Types.ObjectId())).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('finds payments by references', async () => {
    const payment = await paymentRepository.create(createPaymentData({
      provider: 'Razorpay',
      providerOrderId: 'order_123',
      providerPaymentId: 'pay_123',
      utr: 'UTR123456789'
    }));

    const byUtr = await paymentRepository.findByUTR('utr123456789');
    const byProviderOrder = await paymentRepository.findByProviderOrderId('razorpay', 'order_123');
    const byProviderPayment = await paymentRepository.findByProviderPaymentId('razorpay', 'pay_123');

    expect(byUtr._id.toString()).toBe(payment._id.toString());
    expect(byProviderOrder._id.toString()).toBe(payment._id.toString());
    expect(byProviderPayment._id.toString()).toBe(payment._id.toString());
  });

  it('finds the active payment intent for an order', async () => {
    await paymentRepository.create(createPaymentData({
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1000)
    }));
    const active = await paymentRepository.createIntent(createPaymentData({
      status: 'QR_GENERATED',
      expiresAt: new Date(Date.now() + 60000)
    }));

    const result = await paymentRepository.findActivePaymentIntent(orderId);

    expect(result._id.toString()).toBe(active._id.toString());
  });

  it('finds successful payment for an order', async () => {
    const payment = await paymentRepository.create(createPaymentData({
      status: 'VERIFIED',
      utr: 'UTR123456789'
    }));

    const result = await paymentRepository.findSuccessfulPayment(orderId);

    expect(result._id.toString()).toBe(payment._id.toString());
  });

  it('paginates soft search results', async () => {
    await paymentRepository.create(createPaymentData({ amount: 100, status: 'PENDING' }));
    await paymentRepository.create(createPaymentData({ amount: 200, status: 'PENDING' }));
    await paymentRepository.create(createPaymentData({ amount: 300, status: 'PENDING' }));

    const result = await paymentRepository.search({
      statuses: ['PENDING'],
      page: 2,
      limit: 2
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      total: 3,
      page: 2,
      limit: 2,
      pages: 2
    });
  });

  it('lists pending verifications and failed payments', async () => {
    await paymentRepository.create(createPaymentData({ status: 'SUBMITTED', utr: 'UTR123456789' }));
    await paymentRepository.create(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      status: 'VERIFICATION_PENDING',
      utr: 'UTR223456789'
    }));
    await paymentRepository.create(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      status: 'FAILED'
    }));

    const pending = await paymentRepository.listPendingVerifications();
    const failed = await paymentRepository.listFailedPayments();

    expect(pending.pagination.total).toBe(2);
    expect(failed.pagination.total).toBe(1);
  });

  it('submits UTR and moves an active intent to verification pending', async () => {
    const payment = await paymentRepository.create(createPaymentData({
      status: 'PAYMENT_PENDING',
      activeIntent: true,
      expiresAt: new Date(Date.now() + 60000)
    }));

    const updated = await paymentRepository.submitUTR(payment._id, {
      utr: 'utr123456789',
      submittedBy: userId
    });

    expect(updated.status).toBe('VERIFICATION_PENDING');
    expect(updated.utr).toBe('UTR123456789');
    expect(updated.statusHistory.map((entry) => entry.status)).toEqual([
      'PAYMENT_SUBMITTED',
      'VERIFICATION_PENDING'
    ]);
  });

  it('verifies and rejects pending verification payments atomically', async () => {
    const payment = await paymentRepository.create(createPaymentData({
      status: 'VERIFICATION_PENDING',
      utr: 'UTR123456789',
      activeIntent: true
    }));
    const rejectable = await paymentRepository.create(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      status: 'VERIFICATION_PENDING',
      utr: 'UTR987654321',
      activeIntent: true
    }));

    const verified = await paymentRepository.verifyPayment(payment._id, {
      verifiedBy: userId,
      reason: 'Bank statement matched'
    });
    const rejected = await paymentRepository.rejectPayment(rejectable._id, {
      rejectedBy: userId,
      reason: 'UTR not found'
    });

    expect(verified.status).toBe('PAYMENT_VERIFIED');
    expect(verified.successfulPayment).toBe(true);
    expect(verified.activeIntent).toBe(false);
    expect(rejected.status).toBe('PAYMENT_REJECTED');
    expect(rejected.failureReason).toBe('UTR not found');
  });

  it('finds pending verification payments with active intent filters', async () => {
    const payment = await paymentRepository.create(createPaymentData({
      status: 'VERIFICATION_PENDING',
      utr: 'UTR123456789',
      activeIntent: true
    }));
    await paymentRepository.create(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      status: 'VERIFICATION_PENDING',
      utr: 'UTR987654321',
      activeIntent: false
    }));

    const queue = await paymentRepository.findByVerificationStatus('VERIFICATION_PENDING', {}, {
      activeIntent: true
    });
    const pending = await paymentRepository.findPendingVerification(payment._id);

    expect(queue.pagination.total).toBe(1);
    expect(pending._id.toString()).toBe(payment._id.toString());
  });

  it('checks existence by UTR and successful payment', async () => {
    expect(await paymentRepository.existsByUTR('UTR123456789')).toBe(false);
    expect(await paymentRepository.existsSuccessfulPayment(orderId)).toBe(false);

    await paymentRepository.create(createPaymentData({ status: 'VERIFIED', utr: 'UTR123456789' }));

    expect(await paymentRepository.existsByUTR('utr123456789')).toBe(true);
    expect(await paymentRepository.existsSuccessfulPayment(orderId)).toBe(true);
  });

  it('marks expired active payment intents', async () => {
    await paymentRepository.createIntent(createPaymentData({
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000)
    }));
    await paymentRepository.createIntent(createPaymentData({
      order: new mongoose.Types.ObjectId(),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60000)
    }));

    const result = await paymentRepository.markExpiredPayments(new Date());
    const expired = await paymentRepository.findPaymentsByStatus('PAYMENT_EXPIRED');

    expect(result.modifiedCount).toBe(1);
    expect(expired.pagination.total).toBe(1);
  });

  it('supports transaction sessions for writes', async () => {
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      await paymentRepository.create(createPaymentData({ status: 'PENDING' }), { session });
    });

    await session.endSession();

    const result = await paymentRepository.findByOrder(orderId);
    expect(result).toHaveLength(1);
  });

  it('rolls back payment writes when a transaction aborts', async () => {
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await paymentRepository.create(createPaymentData({ status: 'PENDING' }), { session });
      throw new Error('abort transaction');
    })).rejects.toThrow('abort transaction');

    await session.endSession();

    const result = await paymentRepository.findByOrder(orderId);
    expect(result).toHaveLength(0);
  });

  it('handles practical concurrent successful payment writes', async () => {
    const attempts = await Promise.allSettled([
      paymentRepository.create(createPaymentData({ status: 'VERIFIED', utr: 'UTR123456789' })),
      paymentRepository.create(createPaymentData({ status: 'VERIFIED', utr: 'UTR987654321' }))
    ]);

    const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
    const rejected = attempts.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DuplicateSuccessfulPaymentError);
  });
});
