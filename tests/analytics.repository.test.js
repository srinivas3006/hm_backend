const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const analyticsRepository = require('../src/repositories/analyticsRepository');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const Book = require('../src/models/Book');
const User = require('../src/models/User');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('AnalyticsRepository', () => {
  let replSet;
  let book;
  let user;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([AnalyticsEvent.syncIndexes(), Book.syncIndexes(), User.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await AnalyticsEvent.deleteMany({});
    await Book.deleteMany({});
    await User.deleteMany({});
    user = await User.create({ name: 'Reader One', email: 'analytics-reader@example.com', password: 'password123' });
    book = await Book.create({ title: 'Analytics Book', description: 'A book', author: user._id, category: new mongoose.Types.ObjectId(), price: 100 });
  });

  it('records events idempotently and aggregates revenue by period', async () => {
    const event = {
      eventId: 'evt-1',
      eventType: 'PaymentVerified',
      occurredAt: new Date('2026-07-09T00:00:00Z'),
      bucketDay: '2026-07-09',
      amount: 250
    };

    await analyticsRepository.recordEvent(event);
    await analyticsRepository.recordEvent(event);
    const revenue = await analyticsRepository.getRevenueSummary({ period: 'daily' });

    expect(await AnalyticsEvent.countDocuments()).toBe(1);
    expect(revenue).toEqual([{ _id: '2026-07-09', amount: 250, count: 1 }]);
  });

  it('aggregates book sales, payment, inventory, shipment, and customer metrics', async () => {
    await AnalyticsEvent.create([
      { eventId: 'order-1', eventType: 'OrderCreated', occurredAt: new Date(), bucketDay: '2026-07-09', user: user._id, amount: 300 },
      { eventId: 'pay-1', eventType: 'PaymentVerified', occurredAt: new Date(), bucketDay: '2026-07-09', amount: 300 },
      { eventId: 'pay-2', eventType: 'PaymentRejected', occurredAt: new Date(), bucketDay: '2026-07-09', amount: 100 },
      { eventId: 'inv-1', eventType: 'InventoryDeducted', occurredAt: new Date(), bucketDay: '2026-07-09', book: book._id, quantity: 3, amount: 300 },
      { eventId: 'ship-1', eventType: 'ShipmentCreated', occurredAt: new Date(), bucketDay: '2026-07-09' },
      { eventId: 'ship-2', eventType: 'ShipmentDelivered', occurredAt: new Date(), bucketDay: '2026-07-09' }
    ]);

    const books = await analyticsRepository.getBookSales({}, { limit: 5 });
    const payments = await analyticsRepository.getPaymentMetrics();
    const inventory = await analyticsRepository.getInventoryMetrics();
    const shipments = await analyticsRepository.getShipmentMetrics();
    const customers = await analyticsRepository.getCustomerMetrics({}, { limit: 5 });

    expect(books[0].quantity).toBe(3);
    expect(payments.successRate).toBe(0.5);
    expect(inventory[0].quantity).toBe(3);
    expect(shipments).toEqual({ created: 1, delivered: 1 });
    expect(customers[0].orders).toBe(1);
  });
});
