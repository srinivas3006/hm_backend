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
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const PaymentLedger = require('../src/models/PaymentLedger');
const InventoryReservation = require('../src/models/InventoryReservation');
const InventoryLedger = require('../src/models/InventoryLedger');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Admin operations backend', () => {
  let replSet;
  let app;
  let admin;
  let reader;
  let book;
  let adminToken;
  let readerToken;

  const shippingAddress = {
    fullName: 'Reader One',
    addressLine1: '123 Main Street',
    city: 'Bengaluru',
    postalCode: '560001',
    country: 'India'
  };

  const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123');

  const createCheckoutWithSubmittedUTR = async (utr = 'UTR123456789') => {
    const checkout = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user: reader,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: 'UPI'
    });

    await orderPaymentBridgeService.submitOrderUTR(checkout.order._id, utr, reader);
    return checkout;
  };

  beforeAll(async () => {
    process.env.MERCHANT_UPI_ID = 'merchant@upi';
    process.env.MERCHANT_NAME = 'Harglim Publishers';

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    await mongoose.connect(replSet.getUri());

    await Promise.all([
      User.syncIndexes(),
      Order.syncIndexes(),
      Book.syncIndexes(),
      Payment.syncIndexes(),
      PaymentLedger.syncIndexes(),
      InventoryReservation.syncIndexes(),
      InventoryLedger.syncIndexes()
    ]);

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await PaymentLedger.collection.deleteMany({});
    await InventoryReservation.deleteMany({});
    await InventoryLedger.collection.deleteMany({});

    admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin'
    });
    reader = await User.create({
      name: 'Reader One',
      email: 'reader@example.com',
      password: 'password123',
      role: 'reader'
    });
    book = await Book.create({
      title: 'Admin Ops Book',
      slug: 'admin-ops-book',
      description: 'A backend operations test book',
      author: admin._id,
      category: new mongoose.Types.ObjectId(),
      price: 200,
      stock: 5,
      reservedStock: 0,
      isbn: 'ISBN-ADMIN-OPS'
    });

    adminToken = tokenFor(admin);
    readerToken = tokenFor(reader);
  });

  it('requires admin authorization for operations endpoints', async () => {
    await request(app)
      .get('/api/admin/operations/dashboard')
      .expect(401);

    await request(app)
      .get('/api/admin/operations/dashboard')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(403);

    const response = await request(app)
      .get('/api/admin/operations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('pendingPayments');
  });

  it('lists pending payment verification with pagination and filters', async () => {
    await createCheckoutWithSubmittedUTR();

    const response = await request(app)
      .get('/api/admin/operations/payments?group=pending&page=1&limit=5&customer=Reader')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.items[0].status).toBe('VERIFICATION_PENDING');
    expect(response.body.data.items[0].user.email).toBe('reader@example.com');
  });

  it('returns a complete admin payment detail view', async () => {
    const checkout = await createCheckoutWithSubmittedUTR();

    const response = await request(app)
      .get(`/api/admin/operations/payments/${checkout.order.payment}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.payment._id).toBe(String(checkout.order.payment));
    expect(response.body.data.order.orderNumber).toMatch(/^HM-/);
    expect(response.body.data.customer.email).toBe('reader@example.com');
    expect(response.body.data.paymentLedger.length).toBeGreaterThanOrEqual(3);
    expect(response.body.data.inventoryReservations).toHaveLength(1);
    expect(response.body.data.auditHistory.length).toBeGreaterThan(0);
  });

  it('approves payment through PaymentService and deducts reserved inventory', async () => {
    const checkout = await createCheckoutWithSubmittedUTR();

    const response = await request(app)
      .post(`/api/admin/operations/payments/${checkout.order.payment}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bank statement matched' })
      .expect(200);

    const [payment, order, reservation, updatedBook] = await Promise.all([
      Payment.findById(checkout.order.payment).lean(),
      Order.findById(checkout.order._id).lean(),
      InventoryReservation.findOne({ payment: checkout.order.payment }).lean(),
      Book.findById(book._id).lean()
    ]);

    expect(response.body.success).toBe(true);
    expect(payment.status).toBe('PAYMENT_VERIFIED');
    expect(order.isPaid).toBe(true);
    expect(reservation.status).toBe('DEDUCTED');
    expect(updatedBook.stock).toBe(4);
    expect(updatedBook.reservedStock).toBe(0);
  });

  it('exposes inventory operations and financial ledger endpoints', async () => {
    const checkout = await createCheckoutWithSubmittedUTR();

    const reservations = await request(app)
      .get('/api/admin/operations/inventory/reservations?status=RESERVED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const paymentLedger = await request(app)
      .get(`/api/admin/operations/ledger/payments?paymentId=${checkout.order.payment}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const timeline = await request(app)
      .get('/api/admin/operations/ledger/timeline?limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(reservations.body.data.pagination.total).toBe(1);
    expect(paymentLedger.body.data.items.length).toBeGreaterThanOrEqual(3);
    expect(timeline.body.data.length).toBeGreaterThan(0);
  });

  it('supports dashboard summary, low stock, and global search', async () => {
    await createCheckoutWithSubmittedUTR();
    await Book.findByIdAndUpdate(book._id, { stock: 1, reservedStock: 1 });

    const dashboard = await request(app)
      .get('/api/admin/operations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const lowStock = await request(app)
      .get('/api/admin/operations/inventory/low-stock?threshold=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const search = await request(app)
      .get('/api/admin/operations/search?q=Reader')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(dashboard.body.data.pendingPayments).toBe(1);
    expect(lowStock.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    expect(search.body.data.customers[0].email).toBe('reader@example.com');
    expect(search.body.data.payments).toHaveLength(1);
  });
});
