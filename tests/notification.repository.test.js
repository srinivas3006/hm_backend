const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const notificationRepository = require('../src/repositories/notificationRepository');
const Notification = require('../src/models/Notification');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('NotificationRepository', () => {
  let replSet;
  let baseData;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Notification.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
    baseData = {
      idempotencyKey: 'event-1:EMAIL',
      user: new mongoose.Types.ObjectId(),
      eventType: 'PaymentVerified',
      channel: 'EMAIL',
      subject: 'Payment verified',
      body: '<p>Payment verified</p>',
      recipient: {
        email: 'reader@example.com',
        name: 'Reader One'
      }
    };
  });

  it('creates and finds notifications by idempotency key', async () => {
    const notification = await notificationRepository.create(baseData);
    const found = await notificationRepository.findByIdempotencyKey(baseData.idempotencyKey);

    expect(found.notificationId).toBe(notification.notificationId);
    expect(found.status).toBe('PENDING');
  });

  it('updates status, retries, and marks failed', async () => {
    const notification = await notificationRepository.create(baseData);
    const sent = await notificationRepository.updateStatus(notification._id, {
      status: 'SENT',
      sentAt: new Date()
    });
    const pending = await notificationRepository.retry(notification._id);
    const failed = await notificationRepository.markFailed(notification._id, 'provider failed', {
      incrementRetry: true
    });

    expect(sent.status).toBe('SENT');
    expect(pending.status).toBe('PENDING');
    expect(failed.status).toBe('FAILED');
    expect(failed.retryCount).toBe(1);
    expect(failed.lastError).toBe('provider failed');
  });

  it('lists and searches notifications', async () => {
    await notificationRepository.create(baseData);

    const list = await notificationRepository.list({ status: 'PENDING' }, { page: 1, limit: 5 });
    const search = await notificationRepository.search({ search: 'reader@example.com' }, { page: 1, limit: 5 });

    expect(list.pagination.total).toBe(1);
    expect(search.items[0].recipient.email).toBe('reader@example.com');
  });

  it('prevents duplicate idempotency keys', async () => {
    await notificationRepository.create(baseData);

    await expect(notificationRepository.create(baseData))
      .rejects.toMatchObject({ code: 'DUPLICATE_NOTIFICATION' });
  });
});
