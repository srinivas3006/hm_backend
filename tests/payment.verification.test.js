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
  DuplicateUTRError,
  InvalidUTRError,
  PaymentAlreadyCompletedError,
  PaymentExpiredError,
  PaymentIntentInactiveError,
  PaymentUTRAlreadySubmittedError,
  PaymentVerificationAuthorizationError
} = require('../src/services/paymentService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Payment verification workflow', () => {
  let replSet;
  let orderId;
  let userId;
  let adminId;

  const activePayment = (overrides = {}) => ({
    order: orderId,
    user: userId,
    amount: 499,
    status: PAYMENT_STATUS.PAYMENT_PENDING,
    activeIntent: true,
    expiresAt: new Date(Date.now() + 60000),
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

  it('submits a UTR and moves the payment to verification pending', async () => {
    const payment = await paymentService.createManualPayment(activePayment());

    const updated = await paymentService.submitUTR(payment._id, 'utr-123456', {
      userId,
      orderId
    });

    expect(updated.status).toBe(PAYMENT_STATUS.VERIFICATION_PENDING);
    expect(updated.utr).toBe('UTR-123456');
    expect(updated.submittedAt).toBeDefined();
    expect(updated.statusHistory.map((entry) => entry.status)).toEqual([
      PAYMENT_STATUS.PAYMENT_SUBMITTED,
      PAYMENT_STATUS.VERIFICATION_PENDING
    ]);
    expect(logger.info).toHaveBeenCalledWith('payment.utr_submitted', expect.objectContaining({
      maskedUtr: expect.stringMatching(/\*+3456$/)
    }));
  });

  it('rejects duplicate and invalid UTR submissions', async () => {
    await paymentService.createManualPayment(activePayment({
      order: new mongoose.Types.ObjectId(),
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));
    const payment = await paymentService.createManualPayment(activePayment());

    await expect(paymentService.submitUTR(payment._id, 'bad', { userId, orderId }))
      .rejects.toBeInstanceOf(InvalidUTRError);
    await expect(paymentService.submitUTR(payment._id, 'utr123456789', { userId, orderId }))
      .rejects.toBeInstanceOf(DuplicateUTRError);
  });

  it('allows only one UTR per active payment attempt', async () => {
    const payment = await paymentService.createManualPayment(activePayment());
    await paymentService.submitUTR(payment._id, 'UTR123456789', { userId, orderId });

    await expect(paymentService.submitUTR(payment._id, 'UTR987654321', { userId, orderId }))
      .rejects.toBeInstanceOf(PaymentUTRAlreadySubmittedError);
  });

  it('blocks UTR submission for expired or inactive intents', async () => {
    const expired = await paymentService.createManualPayment(activePayment({
      order: new mongoose.Types.ObjectId(),
      expiresAt: new Date(Date.now() - 1000)
    }));
    const inactive = await paymentService.createManualPayment(activePayment({
      order: new mongoose.Types.ObjectId(),
      activeIntent: false
    }));

    await expect(paymentService.submitUTR(expired._id, 'UTR123456789', {
      userId: expired.user,
      orderId: expired.order
    })).rejects.toBeInstanceOf(PaymentExpiredError);
    await expect(paymentService.submitUTR(inactive._id, 'UTR987654321', {
      userId: inactive.user,
      orderId: inactive.order
    })).rejects.toBeInstanceOf(PaymentIntentInactiveError);
  });

  it('verifies a pending manual payment and records audit fields', async () => {
    const payment = await paymentService.createManualPayment(activePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    const updated = await paymentService.verifyPayment(payment._id, { userId: adminId }, {
      reason: 'Bank statement matched'
    });

    expect(updated.status).toBe(PAYMENT_STATUS.PAYMENT_VERIFIED);
    expect(updated.successfulPayment).toBe(true);
    expect(updated.activeIntent).toBe(false);
    expect(updated.verifiedBy.toString()).toBe(adminId.toString());
    expect(logger.info).toHaveBeenCalledWith('payment.verification_started', expect.objectContaining({
      verifier: adminId.toString()
    }));
  });

  it('rejects a pending manual payment and prevents later verification', async () => {
    const payment = await paymentService.createManualPayment(activePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    const rejected = await paymentService.rejectPayment(payment._id, { userId: adminId }, {
      reason: 'UTR not found in statement'
    });

    expect(rejected.status).toBe(PAYMENT_STATUS.PAYMENT_REJECTED);
    expect(rejected.rejectedBy.toString()).toBe(adminId.toString());
    expect(rejected.failureReason).toBe('UTR not found in statement');
    await expect(paymentService.verifyPayment(payment._id, { userId: adminId }))
      .rejects.toBeInstanceOf(PaymentAlreadyCompletedError);
  });

  it('requires an authorized verification actor', async () => {
    const payment = await paymentService.createManualPayment(activePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    await expect(paymentService.verifyPayment(payment._id, {}))
      .rejects.toBeInstanceOf(PaymentVerificationAuthorizationError);
  });

  it('allows only one admin verification to win for the same payment', async () => {
    const payment = await paymentService.createManualPayment(activePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    const results = await Promise.allSettled([
      paymentService.verifyPayment(payment._id, { userId: adminId }),
      paymentService.verifyPayment(payment._id, { userId: new mongoose.Types.ObjectId() })
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await paymentRepository.existsSuccessfulPayment(orderId)).toBe(true);
  });

  it('rolls back verification changes inside an aborted transaction', async () => {
    const payment = await paymentService.createManualPayment(activePayment({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await paymentService.verifyPayment(payment._id, { userId: adminId }, { session });
      throw new Error('abort verification');
    })).rejects.toThrow('abort verification');

    await session.endSession();

    const unchanged = await paymentService.getPayment(payment._id);
    expect(unchanged.status).toBe(PAYMENT_STATUS.VERIFICATION_PENDING);
    expect(unchanged.successfulPayment).toBe(false);
  });
});
