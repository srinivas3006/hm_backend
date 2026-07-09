const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const adminRoutes = require('../src/routes/adminRoutes');
const eventBus = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const { registerAnalyticsSubscriber, resetAnalyticsSubscriberRegistration } = require('../src/events/analyticsSubscriber');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const User = require('../src/models/User');
const Book = require('../src/models/Book');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Analytics integration', () => {
  let replSet;
  let app;
  let admin;
  let book;
  let token;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([AnalyticsEvent.syncIndexes(), User.syncIndexes(), Book.syncIndexes()]);
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
    resetAnalyticsSubscriberRegistration();
    registerAnalyticsSubscriber();
    await AnalyticsEvent.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    admin = await User.create({ name: 'Admin', email: 'analytics-admin@example.com', password: 'password123', role: 'admin' });
    book = await Book.create({ title: 'Best Book', description: 'Book', author: admin._id, category: new mongoose.Types.ObjectId(), price: 100 });
    token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'secret123');
  });

  afterEach(() => {
    eventBus.reset();
    resetAnalyticsSubscriberRegistration();
  });

  it('updates projections from events and serves admin analytics APIs', async () => {
    await eventBus.publish(DOMAIN_EVENTS.ORDER_CREATED, {
      orderId: new mongoose.Types.ObjectId(),
      userId: admin._id,
      totalPrice: 300
    }, { eventId: 'order-created-analytics' });
    await eventBus.publish(DOMAIN_EVENTS.PAYMENT_VERIFIED, {
      paymentId: new mongoose.Types.ObjectId(),
      userId: admin._id,
      amount: 300,
      status: 'PAYMENT_VERIFIED'
    }, { eventId: 'payment-verified-analytics' });
    await eventBus.publish(DOMAIN_EVENTS.INVENTORY_DEDUCTED, {
      bookId: book._id,
      quantity: 3,
      amount: 300
    }, { eventId: 'inventory-deducted-analytics' });
    await eventBus.publish(DOMAIN_EVENTS.SHIPMENT_DELIVERED, {
      shipmentId: new mongoose.Types.ObjectId(),
      customerId: admin._id,
      status: 'DELIVERED'
    }, { eventId: 'shipment-delivered-analytics' });

    expect(await AnalyticsEvent.countDocuments()).toBe(4);

    const dashboard = await request(app).get('/api/admin/analytics/dashboard').set('Authorization', `Bearer ${token}`).expect(200);
    const revenue = await request(app).get('/api/admin/analytics/revenue?period=daily').set('Authorization', `Bearer ${token}`).expect(200);
    const books = await request(app).get('/api/admin/analytics/books?limit=5').set('Authorization', `Bearer ${token}`).expect(200);
    const payments = await request(app).get('/api/admin/analytics/payments').set('Authorization', `Bearer ${token}`).expect(200);
    const inventory = await request(app).get('/api/admin/analytics/inventory').set('Authorization', `Bearer ${token}`).expect(200);
    const shipments = await request(app).get('/api/admin/analytics/shipments').set('Authorization', `Bearer ${token}`).expect(200);
    const customers = await request(app).get('/api/admin/analytics/customers').set('Authorization', `Bearer ${token}`).expect(200);

    expect(dashboard.body.data.type).toBe('dashboard');
    expect(revenue.body.data.data[0].amount).toBe(300);
    expect(books.body.data.data.bestSelling[0].quantity).toBe(3);
    expect(payments.body.data.data.successfulPayments).toBe(1);
    expect(inventory.body.data.data[0].quantity).toBe(3);
    expect(shipments.body.data.data.delivered).toBe(1);
    expect(customers.body.data.data[0].orders).toBe(1);
  });
});
