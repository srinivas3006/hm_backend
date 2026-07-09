jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const adminRoutes = require('../src/routes/adminRoutes');
const orderPaymentBridgeService = require('../src/services/orderPaymentBridgeService');
const eventBus = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const { registerInvoiceSubscriber, resetInvoiceSubscriberRegistration } = require('../src/events/invoiceSubscriber');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const PaymentLedger = require('../src/models/PaymentLedger');
const InventoryReservation = require('../src/models/InventoryReservation');
const InventoryLedger = require('../src/models/InventoryLedger');
const Invoice = require('../src/models/Invoice');
const Counter = require('../src/models/Counter');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Invoice integration', () => {
  let replSet;
  let app;
  let admin;
  let reader;
  let book;
  let adminToken;

  const shippingAddress = {
    fullName: 'Reader One',
    addressLine1: '123 Main Street',
    city: 'Bengaluru',
    postalCode: '560001',
    country: 'India'
  };

  const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123');

  beforeAll(async () => {
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([
      User.syncIndexes(),
      Order.syncIndexes(),
      Book.syncIndexes(),
      Payment.syncIndexes(),
      PaymentLedger.syncIndexes(),
      InventoryReservation.syncIndexes(),
      InventoryLedger.syncIndexes(),
      Invoice.syncIndexes(),
      Counter.syncIndexes()
    ]);

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    eventBus.reset();
    resetInvoiceSubscriberRegistration();
    registerInvoiceSubscriber();
    await User.deleteMany({});
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await PaymentLedger.collection.deleteMany({});
    await InventoryReservation.deleteMany({});
    await InventoryLedger.collection.deleteMany({});
    await Invoice.deleteMany({});
    await Counter.deleteMany({});

    admin = await User.create({
      name: 'Admin User',
      email: 'admin-invoice@example.com',
      password: 'password123',
      role: 'admin'
    });
    reader = await User.create({
      name: 'Reader One',
      email: 'reader-invoice@example.com',
      password: 'password123',
      role: 'reader'
    });
    book = await Book.create({
      title: 'Invoice Integration Book',
      slug: 'invoice-integration-book',
      description: 'Integration invoice book',
      author: admin._id,
      category: new mongoose.Types.ObjectId(),
      price: 200,
      stock: 5
    });
    adminToken = tokenFor(admin);
  });

  afterEach(() => {
    eventBus.reset();
    resetInvoiceSubscriberRegistration();
  });

  const createVerifiedCheckout = async () => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user: reader,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });
    await orderPaymentBridgeService.submitOrderUTR(checkout.order._id, 'UTR123456789', reader);
    await orderPaymentBridgeService.verifyOrderPayment(checkout.order._id, { userId: admin._id }, {
      reason: 'Bank statement matched'
    });
    return checkout;
  };

  it('creates an invoice from PaymentVerified and publishes InvoiceGenerated', async () => {
    const generated = [];
    eventBus.subscribe(DOMAIN_EVENTS.INVOICE_GENERATED, async (event) => generated.push(event.payload.invoiceNumber));

    const checkout = await createVerifiedCheckout();
    const invoice = await Invoice.findOne({ payment: checkout.order.payment }).lean();

    expect(invoice).toBeTruthy();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}-\d{6}$/);
    expect(invoice.total).toBe(260);
    expect(generated).toEqual([invoice.invoiceNumber]);
  });

  it('serves admin list, search, view, and download invoice APIs', async () => {
    await createVerifiedCheckout();
    const invoice = await Invoice.findOne().lean();

    const list = await request(app)
      .get('/api/admin/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const search = await request(app)
      .get(`/api/admin/invoices/search?q=${invoice.invoiceNumber}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const detail = await request(app)
      .get(`/api/admin/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const download = await request(app)
      .get(`/api/admin/invoices/${invoice._id}/download`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data.pagination.total).toBe(1);
    expect(search.body.data.items[0].invoiceNumber).toBe(invoice.invoiceNumber);
    expect(detail.body.data.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(download.headers['content-type']).toMatch(/application\/pdf/);
    expect(download.text || download.body.toString()).toContain('%PDF-1.4');
  });

  it('does not create duplicate invoices when PaymentVerified is replayed', async () => {
    const checkout = await createVerifiedCheckout();
    const payment = await Payment.findById(checkout.order.payment).lean();

    await eventBus.publish(DOMAIN_EVENTS.PAYMENT_VERIFIED, {
      paymentId: String(payment._id),
      orderId: String(payment.order),
      userId: String(payment.user),
      status: payment.status
    }, {
      idempotencyKey: `manual-replay:${payment._id}`
    });

    expect(await Invoice.countDocuments({ payment: payment._id })).toBe(1);
  });
});
