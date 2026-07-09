const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const analyticsService = require('../src/services/analyticsService');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('AnalyticsService', () => {
  let replSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await AnalyticsEvent.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await AnalyticsEvent.deleteMany({});
  });

  it('processes domain events into analytics projections', async () => {
    await analyticsService.processEvent({
      eventId: 'payment-event',
      eventName: DOMAIN_EVENTS.PAYMENT_VERIFIED,
      occurredAt: new Date('2026-07-09T00:00:00Z'),
      payload: { paymentId: new mongoose.Types.ObjectId(), amount: 500, status: 'PAYMENT_VERIFIED' }
    });

    const event = await AnalyticsEvent.findOne().lean();
    expect(event.eventType).toBe(DOMAIN_EVENTS.PAYMENT_VERIFIED);
    expect(event.bucketDay).toBe('2026-07-09');
    expect(event.amount).toBe(500);
  });

  it('handles empty datasets gracefully and returns export-ready reports', async () => {
    const dashboard = await analyticsService.dashboard();
    const payments = await analyticsService.payments();

    expect(dashboard.type).toBe('dashboard');
    expect(dashboard.data.revenue).toEqual([]);
    expect(payments.data.successRate).toBe(0);
  });

  it('supports date filters and report periods', async () => {
    await AnalyticsEvent.create([
      { eventId: 'old', eventType: 'PaymentVerified', occurredAt: new Date('2026-06-01T00:00:00Z'), bucketDay: '2026-06-01', amount: 100 },
      { eventId: 'new', eventType: 'PaymentVerified', occurredAt: new Date('2026-07-09T00:00:00Z'), bucketDay: '2026-07-09', amount: 200 }
    ]);

    const report = await analyticsService.revenue({ dateFrom: '2026-07-01', period: 'monthly' });
    expect(report.data).toEqual([{ _id: '2026-07', amount: 200, count: 1 }]);
  });
});
