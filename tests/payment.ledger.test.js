jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const paymentService = require('../src/services/paymentService');
const paymentLedgerRepository = require('../src/repositories/paymentLedgerRepository');
const Payment = require('../src/models/Payment');
const PaymentLedger = require('../src/models/PaymentLedger');
const logger = require('../src/utils/logger');

const {
  DuplicatePaymentLedgerEntryError
} = require('../src/repositories/paymentLedgerRepository');

const {
  PAYMENT_STATUS
} = require('../src/services/paymentService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Payment ledger foundation', () => {
  let replSet;
  let orderId;
  let userId;
  let adminId;

  const paymentData = (overrides = {}) => ({
    order: orderId,
    user: userId,
    amount: 499,
    status: PAYMENT_STATUS.PAYMENT_PENDING,
    activeIntent: true,
    expiresAt: new Date(Date.now() + 60000),
    ...overrides
  });

  const ledgerData = (overrides = {}) => ({
    eventKey: `${new mongoose.Types.ObjectId()}:PAYMENT_VERIFIED`,
    paymentId: new mongoose.Types.ObjectId(),
    orderId,
    userId,
    eventType: PAYMENT_STATUS.PAYMENT_VERIFIED,
    previousStatus: PAYMENT_STATUS.VERIFICATION_PENDING,
    currentStatus: PAYMENT_STATUS.PAYMENT_VERIFIED,
    amount: 499,
    currency: 'INR',
    provider: 'manual_upi',
    actor: adminId,
    actorType: 'ADMIN',
    reason: 'Bank statement matched',
    ...overrides
  });

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    await mongoose.connect(replSet.getUri());
    await Payment.syncIndexes();
    await PaymentLedger.syncIndexes();
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
    await PaymentLedger.collection.deleteMany({});
  });

  it('creates append-only ledger entries through the repository', async () => {
    const entry = await paymentLedgerRepository.createEntry(ledgerData());

    expect(entry.ledgerId).toBeDefined();
    expect(entry.eventType).toBe(PAYMENT_STATUS.PAYMENT_VERIFIED);
    expect(entry.createdAt).toBeDefined();
  });

  it('prevents duplicate ledger entries when an event key is supplied', async () => {
    const eventKey = `${new mongoose.Types.ObjectId()}:PAYMENT_VERIFIED`;
    await paymentLedgerRepository.createEntry(ledgerData({ eventKey }));

    await expect(paymentLedgerRepository.createEntry(ledgerData({ eventKey })))
      .rejects.toBeInstanceOf(DuplicatePaymentLedgerEntryError);
  });

  it('blocks updates and deletes on ledger records', async () => {
    const entry = await paymentLedgerRepository.createEntry(ledgerData());

    entry.reason = 'tampered';
    await expect(entry.save()).rejects.toThrow('append-only');
    await expect(PaymentLedger.updateOne({ _id: entry._id }, { $set: { reason: 'tampered' } }))
      .rejects.toThrow('append-only');
    await expect(PaymentLedger.deleteOne({ _id: entry._id }))
      .rejects.toThrow('append-only');
  });

  it('supports indexed audit queries by payment, order, user, event, and date range', async () => {
    const paymentId = new mongoose.Types.ObjectId();
    await paymentLedgerRepository.createEntry(ledgerData({
      paymentId,
      eventType: 'INTENT_CREATED',
      currentStatus: 'INTENT_CREATED',
      eventKey: `${paymentId}:INTENT_CREATED`
    }));
    await paymentLedgerRepository.createEntry(ledgerData({
      paymentId,
      eventType: PAYMENT_STATUS.PAYMENT_VERIFIED,
      currentStatus: PAYMENT_STATUS.PAYMENT_VERIFIED,
      eventKey: `${paymentId}:PAYMENT_VERIFIED`
    }));

    const byPayment = await paymentLedgerRepository.listByPayment(paymentId);
    const byOrder = await paymentLedgerRepository.listByOrder(orderId);
    const byUser = await paymentLedgerRepository.listByUser(userId);
    const byEvent = await paymentLedgerRepository.listByEvent(PAYMENT_STATUS.PAYMENT_VERIFIED);
    const byDate = await paymentLedgerRepository.listByDateRange({
      from: new Date(Date.now() - 60000),
      to: new Date(Date.now() + 60000)
    });

    expect(byPayment.pagination.total).toBe(2);
    expect(byOrder.pagination.total).toBe(2);
    expect(byUser.pagination.total).toBe(2);
    expect(byEvent.pagination.total).toBe(1);
    expect(byDate.pagination.total).toBe(2);
  });

  it('creates ledger entries for UTR submission and verification', async () => {
    const payment = await paymentService.createManualPayment(paymentData());
    await paymentService.submitUTR(payment._id, 'UTR123456789', { userId, orderId });
    const verified = await paymentService.verifyPayment(payment._id, { userId: adminId }, {
      reason: 'Bank statement matched'
    });

    const ledger = await paymentLedgerRepository.listByPayment(payment._id);
    const events = ledger.items.map((entry) => entry.eventType);

    expect(verified.status).toBe(PAYMENT_STATUS.PAYMENT_VERIFIED);
    expect(events).toEqual([
      PAYMENT_STATUS.PAYMENT_SUBMITTED,
      PAYMENT_STATUS.VERIFICATION_PENDING,
      PAYMENT_STATUS.PAYMENT_VERIFIED
    ]);
    expect(ledger.items[2].actor.toString()).toBe(adminId.toString());
    expect(logger.info).toHaveBeenCalledWith('payment_ledger.entry_created', expect.objectContaining({
      eventType: PAYMENT_STATUS.PAYMENT_VERIFIED,
      reference: expect.stringMatching(/\*+6789$/)
    }));
  });

  it('creates a ledger entry for payment rejection', async () => {
    const payment = await paymentService.createManualPayment(paymentData({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    await paymentService.rejectPayment(payment._id, { userId: adminId }, {
      reason: 'UTR not found'
    });

    const ledger = await paymentLedgerRepository.listByPayment(payment._id);

    expect(ledger.pagination.total).toBe(1);
    expect(ledger.items[0].eventType).toBe(PAYMENT_STATUS.PAYMENT_REJECTED);
    expect(ledger.items[0].reason).toBe('UTR not found');
  });

  it('rolls back payment and ledger writes in the same transaction', async () => {
    const payment = await paymentService.createManualPayment(paymentData({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await paymentService.verifyPayment(payment._id, { userId: adminId }, { session });
      throw new Error('abort ledger transaction');
    })).rejects.toThrow('abort ledger transaction');

    await session.endSession();

    const unchanged = await Payment.findById(payment._id).lean();
    const ledger = await paymentLedgerRepository.listByPayment(payment._id);

    expect(unchanged.status).toBe(PAYMENT_STATUS.VERIFICATION_PENDING);
    expect(ledger.pagination.total).toBe(0);
  });

  it('allows only one concurrent verification ledger event to be created', async () => {
    const payment = await paymentService.createManualPayment(paymentData({
      status: PAYMENT_STATUS.VERIFICATION_PENDING,
      utr: 'UTR123456789'
    }));

    const results = await Promise.allSettled([
      paymentService.verifyPayment(payment._id, { userId: adminId }),
      paymentService.verifyPayment(payment._id, { userId: new mongoose.Types.ObjectId() })
    ]);
    const ledger = await paymentLedgerRepository.listByPayment(payment._id);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(ledger.pagination.total).toBe(1);
    expect(ledger.items[0].eventType).toBe(PAYMENT_STATUS.PAYMENT_VERIFIED);
  });
});
