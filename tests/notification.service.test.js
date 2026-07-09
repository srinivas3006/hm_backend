jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { NotificationService } = require('../src/services/notificationService');
const notificationRepository = require('../src/repositories/notificationRepository');
const templateRenderer = require('../src/notifications/templates/notificationTemplates');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('NotificationService', () => {
  let replSet;
  let user;
  let order;
  let payment;
  let sendMock;
  let service;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([
      Notification.syncIndexes(),
      User.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes()
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});

    user = await User.create({
      name: 'Reader One',
      email: 'reader-notify@example.com',
      password: 'password123',
      role: 'reader'
    });
    order = await Order.create({
      orderNumber: 'HM-NOTIFY',
      user: user._id,
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
      user: user._id,
      amount: 155,
      currency: 'INR',
      paymentMethod: 'UPI',
      provider: 'manual_upi',
      status: 'PAYMENT_VERIFIED',
      successfulPayment: true
    });
    sendMock = jest.fn().mockResolvedValue({ success: true });
    service = new NotificationService({
      repository: notificationRepository,
      renderer: templateRenderer,
      adapters: {
        EMAIL: { send: sendMock },
        IN_APP: { send: sendMock }
      },
      serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });
  });

  const event = () => ({
    eventId: 'event-payment-verified',
    eventName: DOMAIN_EVENTS.PAYMENT_VERIFIED,
    correlationId: 'corr-1',
    payload: {
      paymentId: String(payment._id),
      orderId: String(order._id),
      userId: String(user._id)
    }
  });

  it('creates and sends an email notification from a domain event', async () => {
    const [notification] = await service.handleDomainEvent(event());

    expect(notification.status).toBe('SENT');
    expect(notification.channel).toBe('EMAIL');
    expect(notification.subject).toBe('Payment verified');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate notifications for the same event/channel', async () => {
    await service.handleDomainEvent(event());
    await service.handleDomainEvent(event());

    expect(await Notification.countDocuments()).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('marks failed notifications and supports admin retry', async () => {
    sendMock.mockResolvedValueOnce({ success: false, error: 'provider down' });

    await expect(service.handleDomainEvent(event())).rejects.toMatchObject({ code: 'NOTIFICATION_DELIVERY_ERROR' });
    const failed = await Notification.findOne().lean();
    expect(failed.status).toBe('FAILED');
    expect(failed.retryCount).toBe(1);

    sendMock.mockResolvedValueOnce({ success: true });
    const retried = await service.retryNotification(failed._id);
    expect(retried.status).toBe('SENT');
    expect((await Notification.findById(failed._id).lean()).retryCount).toBe(1);
  });
});
