const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Payment = require('../src/models/Payment');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Payment model validation', () => {
  it('creates a valid manual UPI payment attempt with defaults', async () => {
    const payment = new Payment({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 499
    });

    await expect(payment.validate()).resolves.toBeUndefined();
    expect(payment.currency).toBe('INR');
    expect(payment.paymentMethod).toBe('UPI');
    expect(payment.provider).toBe('manual_upi');
    expect(payment.status).toBe('INTENT_CREATED');
    expect(payment.successfulPayment).toBe(false);
  });

  it('allows an arbitrary provider string for future gateways', async () => {
    const payment = new Payment({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 1299,
      provider: 'FutureGateway',
      paymentMethod: 'CARD',
      providerOrderId: 'order_123',
      providerPaymentId: 'pay_123'
    });

    await expect(payment.validate()).resolves.toBeUndefined();
    expect(payment.provider).toBe('futuregateway');
  });

  it('rejects invalid payment statuses', async () => {
    const payment = new Payment({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 499,
      status: 'PAID'
    });

    await expect(payment.validate()).rejects.toThrow();
  });

  it('normalizes and validates UTR values', async () => {
    const payment = new Payment({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 499,
      utr: 'abc123456789'
    });

    await expect(payment.validate()).resolves.toBeUndefined();
    expect(payment.utr).toBe('ABC123456789');
  });

  it('marks verified and refunded payment states as successful attempts', async () => {
    const payment = new Payment({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 499,
      status: 'VERIFIED'
    });

    await expect(payment.validate()).resolves.toBeUndefined();
    expect(payment.successfulPayment).toBe(true);
    expect(payment.verifiedAt).toBeInstanceOf(Date);
  });
});

describe('Payment model indexes', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Payment.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
  });

  it('allows multiple non-successful payment attempts for one order', async () => {
    const order = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();

    await Payment.create({
      order,
      user,
      amount: 499,
      status: 'FAILED',
      attemptNumber: 1
    });

    await expect(Payment.create({
      order,
      user,
      amount: 499,
      status: 'PENDING',
      attemptNumber: 2
    })).resolves.toBeDefined();
  });

  it('allows only one successful payment for one order', async () => {
    const order = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();

    await Payment.create({
      order,
      user,
      amount: 499,
      status: 'VERIFIED',
      utr: 'UTR123456789'
    });

    await expect(Payment.create({
      order,
      user,
      amount: 499,
      status: 'VERIFIED',
      utr: 'UTR987654321'
    })).rejects.toThrow();
  });

  it('enforces unique UTR values when provided', async () => {
    await Payment.create({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 499,
      status: 'SUBMITTED',
      utr: 'UTR123456789'
    });

    await expect(Payment.create({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      amount: 699,
      status: 'SUBMITTED',
      utr: 'UTR123456789'
    })).rejects.toThrow();
  });
});
