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
  UPIQRCodeService,
  QRConfigurationError
} = require('../src/payments/qr/upiQRCodeService');

const {
  PAYMENT_STATUS,
  PaymentExpiredError,
  PaymentIntentAmountMismatchError,
  PaymentQRCodeGenerationError
} = require('../src/services/paymentService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Dynamic UPI QR generation', () => {
  let replSet;
  let orderId;
  let userId;

  const intentData = (overrides = {}) => ({
    order: orderId,
    user: userId,
    amount: 499,
    ...overrides
  });

  beforeAll(async () => {
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';
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
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';
    await Payment.deleteMany({});
  });

  it('builds a standards-style UPI URI and QR data URL', async () => {
    const qrService = new UPIQRCodeService(() => ({
      upi: {
        merchantUpiId: 'merchant@upi',
        merchantName: 'Harglim Publishers',
        merchantCode: '1234',
        currency: 'INR'
      }
    }));

    const result = await qrService.generate({
      amount: 499,
      currency: 'INR',
      orderReference: 'HM-ORDER1',
      intentId: 'intent_123',
      transactionReference: 'PAY-intent_123',
      transactionNote: 'Order HM-ORDER1'
    });

    expect(result.upiUri).toContain('upi://pay?');
    expect(result.upiUri).toContain('pa=merchant%40upi');
    expect(result.upiUri).toContain('pn=Harglim+Publishers');
    expect(result.upiUri).toContain('am=499.00');
    expect(result.upiUri).toContain('cu=INR');
    expect(result.upiUri).toContain('tr=PAY-intent_123');
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects invalid merchant UPI configuration', async () => {
    const qrService = new UPIQRCodeService(() => ({
      upi: {
        merchantUpiId: 'not-a-upi-id',
        merchantName: 'Harglim Publishers',
        currency: 'INR'
      }
    }));

    await expect(qrService.generate({
      amount: 499,
      orderReference: 'HM-ORDER1',
      intentId: 'intent_123'
    })).rejects.toBeInstanceOf(QRConfigurationError);
  });

  it('generates and stores QR metadata for an active intent', async () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const intent = await paymentService.createPaymentIntent(intentData(), {
      orderAmount: 499,
      now,
      expiresAt: new Date('2026-07-08T10:20:00.000Z')
    });

    const qr = await paymentService.generateQRCode(intent._id, {
      orderId,
      userId,
      amount: 499,
      orderReference: 'HM-123',
      transactionNote: 'Order HM-123',
      now
    });

    expect(qr.status).toBe(PAYMENT_STATUS.QR_GENERATED);
    expect(qr.upiUri).toContain('am=499.00');
    expect(qr.upiUri).toContain('tr=PAY-');
    expect(qr.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qr.qrExpiresAt.toISOString()).toBe('2026-07-08T10:20:00.000Z');
    expect(qr.metadata.orderReference).toBe('HM-123');
    expect(logger.info).toHaveBeenCalledWith('payment_qr.generated', expect.objectContaining({
      paymentId: intent._id.toString()
    }));
  });

  it('reuses an existing valid QR without regenerating', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });
    const first = await paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 });
    const second = await paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 });

    expect(second.upiUri).toBe(first.upiUri);
    expect(second.qrCodeDataUrl).toBe(first.qrCodeDataUrl);
    expect(logger.info).toHaveBeenCalledWith('payment_qr.reused', expect.objectContaining({
      paymentId: intent._id.toString()
    }));
  });

  it('regenerates QR metadata when explicitly requested', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });
    const first = await paymentService.generateQRCode(intent._id, {
      orderId,
      userId,
      amount: 499,
      now: new Date('2026-07-08T10:00:00.000Z')
    });
    const second = await paymentService.regenerateQRCode(intent._id, {
      orderId,
      userId,
      amount: 499,
      now: new Date('2026-07-08T10:01:00.000Z')
    });

    expect(new Date(second.qrGeneratedAt).getTime()).toBeGreaterThan(new Date(first.qrGeneratedAt).getTime());
    expect(logger.info).toHaveBeenCalledWith('payment_qr.regenerated', expect.objectContaining({
      paymentId: intent._id.toString()
    }));
  });

  it('returns an existing valid QR', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });
    const generated = await paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 });
    const existing = await paymentService.getQRCode(intent._id, { orderId, userId, amount: 499 });

    expect(existing.upiUri).toBe(generated.upiUri);
    expect(existing.qrCodeDataUrl).toBe(generated.qrCodeDataUrl);
  });

  it('rejects QR generation for expired intents', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), {
      orderAmount: 499,
      expiresAt: new Date(Date.now() - 1000)
    });

    await expect(paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 }))
      .rejects.toBeInstanceOf(PaymentExpiredError);
  });

  it('rejects QR generation for cancelled intents', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });
    const cancelled = await paymentService.cancelIntent(intent._id, { userId }, { orderId, userId });

    await expect(paymentService.generateQRCode(cancelled._id, { orderId, userId, amount: 499 }))
      .rejects.toThrow();
  });

  it('rejects QR generation when amount differs from locked intent amount', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });

    await expect(paymentService.generateQRCode(intent._id, { orderId, userId, amount: 500 }))
      .rejects.toBeInstanceOf(PaymentIntentAmountMismatchError);
  });

  it('maps QR provider configuration failures to service errors', async () => {
    process.env.MERCHANT_UPI_ID = '';
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });

    await expect(paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 }))
      .rejects.toBeInstanceOf(PaymentQRCodeGenerationError);
  });

  it('persists QR metadata through repository helpers', async () => {
    const intent = await paymentRepository.createIntent(intentData({
      expiresAt: new Date(Date.now() + 60000)
    }));

    await paymentRepository.saveQRCodeMetadata(intent._id, {
      qrPayload: 'upi://pay?pa=merchant@upi&am=499.00',
      qrCodeDataUrl: 'data:image/png;base64,abc',
      qrGeneratedAt: new Date(),
      qrExpiresAt: new Date(Date.now() + 60000),
      status: PAYMENT_STATUS.QR_GENERATED,
      activeIntent: true,
      metadata: { orderReference: 'HM-123' }
    });

    const latest = await paymentRepository.findLatestQRCode(intent._id);

    expect(latest.qrPayload).toContain('upi://pay');
    expect(latest.qrCodeDataUrl).toBe('data:image/png;base64,abc');
    expect(latest.qrMetadata.orderReference).toBe('HM-123');
  });

  it('handles practical concurrent QR requests by reusing persisted QR data', async () => {
    const intent = await paymentService.createPaymentIntent(intentData(), { orderAmount: 499 });

    const results = await Promise.all([
      paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 }),
      paymentService.generateQRCode(intent._id, { orderId, userId, amount: 499 })
    ]);

    expect(results[0].upiUri).toBe(results[1].upiUri);
    expect(results[0].qrCodeDataUrl).toBe(results[1].qrCodeDataUrl);
  });
});
