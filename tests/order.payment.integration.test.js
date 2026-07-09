jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../src/utils/emailService', () => ({
  sendOrderConfirmation: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createOrder, verifyPayment, cancelOrder } = require('../src/controllers/orderController');
const orderPaymentBridgeService = require('../src/services/orderPaymentBridgeService');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const PaymentLedger = require('../src/models/PaymentLedger');
const InventoryReservation = require('../src/models/InventoryReservation');
const InventoryLedger = require('../src/models/InventoryLedger');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Order payment bridge integration', () => {
  let replSet;
  let user;
  let book;

  const shippingAddress = {
    fullName: 'Reader One',
    addressLine1: '123 Main Street',
    city: 'Bengaluru',
    postalCode: '560001',
    country: 'India'
  };

  const createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeAll(async () => {
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    await mongoose.connect(replSet.getUri());
    await Order.syncIndexes();
    await Book.syncIndexes();
    await Payment.syncIndexes();
    await PaymentLedger.syncIndexes();
    await InventoryReservation.syncIndexes();
    await InventoryLedger.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    user = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Reader One',
      email: 'reader@example.com'
    };
    jest.clearAllMocks();
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await PaymentLedger.collection.deleteMany({});
    await InventoryReservation.deleteMany({});
    await InventoryLedger.collection.deleteMany({});
    book = await Book.create({
      title: 'Production Book',
      description: 'A production-ready test book',
      author: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      price: 200,
      stock: 5
    });
  });

  it('preserves order creation response compatibility while creating payment intent and QR', async () => {
    const req = {
      user,
      body: {
        items: [{ bookId: book._id, quantity: 2 }],
        shippingAddress,
        paymentMethod: 'UPI'
      }
    };
    const res = createMockResponse();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.order.orderNumber).toMatch(/^HM-/);
    expect(body.data.order.paymentMethod).toBe('UPI');
    expect(body.data.order.isPaid).toBe(false);
    expect(body.data.payment).toEqual(expect.objectContaining({
      upiUrl: expect.stringContaining('upi://pay?'),
      qrCodeDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      amount: 470
    }));

    const payment = await Payment.findOne({ order: body.data.order._id }).lean();
    const ledgerEvents = await PaymentLedger.find({ paymentId: payment._id }).sort({ createdAt: 1 }).lean();
    const updatedBook = await Book.findById(book._id).lean();

    expect(payment).toBeTruthy();
    expect(String(body.data.order.payment)).toBe(String(payment._id));
    expect(payment.status).toBe('QR_GENERATED');
    const reservation = await InventoryReservation.findOne({ order: body.data.order._id }).lean();
    expect(updatedBook.stock).toBe(5);
    expect(updatedBook.reservedStock).toBe(2);
    expect(reservation.status).toBe('RESERVED');
    expect(ledgerEvents.map((entry) => entry.eventType)).toEqual(['INTENT_CREATED', 'QR_GENERATED']);
  });

  it('submits UTR through existing endpoint and syncs legacy order fields', async () => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });
    const req = {
      user,
      params: { id: checkout.order._id },
      body: { utr: 'utr123456789' }
    };
    const res = createMockResponse();

    await verifyPayment(req, res);

    const body = res.json.mock.calls[0][0];
    const payment = await Payment.findById(checkout.order.payment).lean();

    expect(res.status).not.toHaveBeenCalled();
    expect(body.success).toBe(true);
    expect(body.data.utr).toBe('UTR123456789');
    expect(body.data.isPaid).toBe(false);
    expect(body.data.paymentMethod).toBe('UPI');
    expect(body.data.status).toBe('PENDING');
    expect(body.data.trackingUpdates[0].status).toBe('Payment Submitted');
    expect(payment.status).toBe('VERIFICATION_PENDING');
    expect(payment.utr).toBe('UTR123456789');
  });

  it('synchronizes paid compatibility fields after internal payment verification', async () => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });
    await orderPaymentBridgeService.submitOrderUTR(checkout.order._id, 'UTR123456789', user);

    const syncedOrder = await orderPaymentBridgeService.verifyOrderPayment(checkout.order._id, {
      userId: new mongoose.Types.ObjectId()
    }, {
      reason: 'Bank statement matched'
    });
    const payment = await Payment.findById(syncedOrder.payment).lean();

    expect(payment.status).toBe('PAYMENT_VERIFIED');
    expect(syncedOrder.isPaid).toBe(true);
    expect(syncedOrder.paidAt).toBeDefined();
    expect(syncedOrder.utr).toBe('UTR123456789');
    expect(syncedOrder.paymentMethod).toBe('UPI');
    expect(syncedOrder.status).toBe('PENDING');
    const updatedBook = await Book.findById(book._id).lean();
    const reservation = await InventoryReservation.findOne({ order: syncedOrder._id }).lean();
    expect(updatedBook.stock).toBe(4);
    expect(updatedBook.reservedStock).toBe(0);
    expect(reservation.status).toBe('DEDUCTED');
  });

  it('rolls back order, payment, ledger, and stock when QR generation fails', async () => {
    process.env.MERCHANT_UPI_ID = 'invalid-upi-id';
    const req = {
      user,
      body: {
        items: [{ bookId: book._id, quantity: 2 }],
        shippingAddress,
        paymentMethod: 'UPI'
      }
    };
    const res = createMockResponse();

    await createOrder(req, res);

    const updatedBook = await Book.findById(book._id).lean();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect(await PaymentLedger.countDocuments()).toBe(0);
    expect(await InventoryReservation.countDocuments()).toBe(0);
    expect(await InventoryLedger.countDocuments()).toBe(0);
    expect(updatedBook.stock).toBe(5);
    expect(updatedBook.reservedStock).toBe(0);
  });

  it('preserves authorization behavior for legacy UTR endpoint', async () => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });
    const req = {
      user: { ...user, _id: new mongoose.Types.ObjectId() },
      params: { id: checkout.order._id },
      body: { utr: 'UTR123456789' }
    };
    const res = createMockResponse();

    await verifyPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      message: 'Not authorized to update this order'
    });
  });

  it('releases reserved inventory and cancels active payment when order is cancelled', async () => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user,
      items: [{ bookId: book._id, quantity: 2 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });
    const req = {
      user,
      params: { id: checkout.order._id }
    };
    const res = createMockResponse();

    await cancelOrder(req, res);

    const updatedBook = await Book.findById(book._id).lean();
    const payment = await Payment.findById(checkout.order.payment).lean();
    const reservation = await InventoryReservation.findOne({ order: checkout.order._id }).lean();

    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(res.json.mock.calls[0][0].data.status).toBe('CANCELLED');
    expect(updatedBook.stock).toBe(5);
    expect(updatedBook.reservedStock).toBe(0);
    expect(payment.status).toBe('PAYMENT_CANCELLED');
    expect(reservation.status).toBe('RELEASED');
  });
});
