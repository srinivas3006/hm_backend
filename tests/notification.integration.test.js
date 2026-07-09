jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../src/utils/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn(),
  sendOrderConfirmation: jest.fn(),
  sendPublishRequestUpdate: jest.fn()
}));

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const adminRoutes = require('../src/routes/adminRoutes');
const eventBus = require('../src/events/eventBus');
const jobQueue = require('../src/jobs/jobQueue');
const eventWorker = require('../src/workers/eventWorker');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const { registerNotificationSubscriber, resetNotificationSubscriberRegistration } = require('../src/events/notificationSubscriber');
const { sendEmail } = require('../src/utils/emailService');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Notification = require('../src/models/Notification');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Notification integration', () => {
  let replSet;
  let app;
  let admin;
  let reader;
  let order;
  let payment;
  let adminToken;

  const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123');

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([
      User.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes(),
      Notification.syncIndexes()
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
    jobQueue.reset();
    eventWorker.reset();
    resetNotificationSubscriberRegistration();
    registerNotificationSubscriber();
    sendEmail.mockClear();
    sendEmail.mockResolvedValue(true);

    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
    await Notification.deleteMany({});

    admin = await User.create({
      name: 'Admin User',
      email: 'admin-notify@example.com',
      password: 'password123',
      role: 'admin'
    });
    reader = await User.create({
      name: 'Reader One',
      email: 'reader-notify@example.com',
      password: 'password123',
      role: 'reader'
    });
    order = await Order.create({
      orderNumber: 'HM-NOTIFY-INT',
      user: reader._id,
      items: [{ book: new mongoose.Types.ObjectId(), quantity: 1, price: 100 }],
      shippingAddress: {
        fullName: 'Reader One',
        addressLine1: '123 Main Street',
        city: 'Bengaluru',
        postalCode: '560001',
        country: 'India'
      },
      subtotal: 100,
      tax: 5,
      shippingPrice: 50,
      totalPrice: 155
    });
    payment = await Payment.create({
      order: order._id,
      user: reader._id,
      amount: 155,
      currency: 'INR',
      paymentMethod: 'UPI',
      provider: 'manual_upi',
      status: 'PAYMENT_VERIFIED',
      successfulPayment: true
    });
    adminToken = tokenFor(admin);
  });

  afterEach(() => {
    eventBus.reset();
    jobQueue.reset();
    eventWorker.reset();
    resetNotificationSubscriberRegistration();
  });

  const publishPaymentVerified = () => eventBus.publish(DOMAIN_EVENTS.PAYMENT_VERIFIED, {
    paymentId: String(payment._id),
    orderId: String(order._id),
    userId: String(reader._id),
    status: 'PAYMENT_VERIFIED'
  }, {
    eventId: 'payment-verified-event',
    idempotencyKey: `test:${payment._id}`
  });

  it('queues notification work and creates notifications asynchronously', async () => {
    await publishPaymentVerified();

    expect(await Notification.countDocuments()).toBe(0);
    expect(jobQueue.size()).toBe(1);

    await eventWorker.process({ now: new Date(Date.now() + 1000) });
    const notification = await Notification.findOne().lean();

    expect(notification.status).toBe('SENT');
    expect(notification.eventType).toBe(DOMAIN_EVENTS.PAYMENT_VERIFIED);
    expect(notification.recipient.email).toBe('reader-notify@example.com');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate notifications when an event is replayed', async () => {
    await publishPaymentVerified();
    await eventWorker.process({ now: new Date(Date.now() + 1000) });

    await eventBus.publish(DOMAIN_EVENTS.PAYMENT_VERIFIED, {
      paymentId: String(payment._id),
      orderId: String(order._id),
      userId: String(reader._id)
    }, {
      eventId: 'payment-verified-event',
      idempotencyKey: `test:${payment._id}`
    });
    await eventWorker.process({ now: new Date(Date.now() + 1000) });

    expect(await Notification.countDocuments()).toBe(1);
  });

  it('serves admin list, search, view, and retry APIs', async () => {
    await publishPaymentVerified();
    await eventWorker.process({ now: new Date(Date.now() + 1000) });
    const notification = await Notification.findOne().lean();

    const list = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const search = await request(app)
      .get('/api/admin/notifications/search?q=Payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const detail = await request(app)
      .get(`/api/admin/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await Notification.findByIdAndUpdate(notification._id, {
      status: 'FAILED',
      lastError: 'temporary failure'
    });
    sendEmail.mockResolvedValueOnce(true);
    const retry = await request(app)
      .post(`/api/admin/notifications/${notification._id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data.pagination.total).toBe(1);
    expect(search.body.data.items[0].eventType).toBe(DOMAIN_EVENTS.PAYMENT_VERIFIED);
    expect(detail.body.data.subject).toBe('Payment verified');
    expect(retry.body.data.status).toBe('SENT');
  });
});
