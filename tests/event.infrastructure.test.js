jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { EventBus } = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const { JobQueue } = require('../src/jobs/jobQueue');
const eventBus = require('../src/events/eventBus');
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

describe('Event-driven infrastructure', () => {
  let replSet;

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
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    eventBus.reset();
    await User.deleteMany({});
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await PaymentLedger.collection.deleteMany({});
    await InventoryReservation.deleteMany({});
    await InventoryLedger.collection.deleteMany({});
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('publishes events to subscribers in priority order', async () => {
    const bus = new EventBus();
    const received = [];

    bus.subscribe(DOMAIN_EVENTS.PAYMENT_VERIFIED, async () => received.push('low'), { priority: 1 });
    bus.subscribe(DOMAIN_EVENTS.PAYMENT_VERIFIED, async () => received.push('high'), { priority: 10 });

    await bus.publish(DOMAIN_EVENTS.PAYMENT_VERIFIED, { paymentId: 'payment-1' });

    expect(received).toEqual(['high', 'low']);
    expect(bus.getMetrics().delivered).toBe(2);
  });

  it('ignores duplicate events by event id and idempotency key', async () => {
    const bus = new EventBus();
    const received = [];

    bus.subscribe(DOMAIN_EVENTS.PAYMENT_SUBMITTED, async (event) => received.push(event.eventId));
    await bus.publish(DOMAIN_EVENTS.PAYMENT_SUBMITTED, {}, {
      eventId: 'event-1',
      idempotencyKey: 'payment-submitted-1'
    });
    await bus.publish(DOMAIN_EVENTS.PAYMENT_SUBMITTED, {}, {
      eventId: 'event-1',
      idempotencyKey: 'payment-submitted-1'
    });
    await bus.publish(DOMAIN_EVENTS.PAYMENT_SUBMITTED, {}, {
      eventId: 'event-2',
      idempotencyKey: 'payment-submitted-1'
    });

    expect(received).toEqual(['event-1']);
    expect(bus.getMetrics().duplicates).toBe(2);
  });

  it('defers session events until explicit transaction flush and discards on rollback', async () => {
    const bus = new EventBus();
    const received = [];
    const session = await mongoose.startSession();

    bus.subscribe(DOMAIN_EVENTS.ORDER_CREATED, async (event) => received.push(event.eventName));
    session.startTransaction();
    await bus.publish(DOMAIN_EVENTS.ORDER_CREATED, { orderId: 'order-1' }, { session });
    expect(received).toEqual([]);

    await session.commitTransaction();
    await bus.flushSession(session);
    expect(received).toEqual([DOMAIN_EVENTS.ORDER_CREATED]);
    session.endSession();

    const rollbackSession = await mongoose.startSession();
    rollbackSession.startTransaction();
    await bus.publish(DOMAIN_EVENTS.ORDER_CANCELLED, { orderId: 'order-1' }, { session: rollbackSession });
    await rollbackSession.abortTransaction();
    bus.discardSession(rollbackSession);
    await bus.flushSession(rollbackSession);
    rollbackSession.endSession();

    expect(received).toEqual([DOMAIN_EVENTS.ORDER_CREATED]);
  });

  it('queues jobs with retries and moves exhausted failures to dead letter storage', async () => {
    const queue = new JobQueue({ name: 'test' });
    let attempts = 0;

    await queue.add('FailingJob', { id: 1 }, {
      maxAttempts: 2,
      backoffMs: 1,
      idempotencyKey: 'job-1'
    });
    await queue.process(async () => {
      attempts += 1;
      throw new Error('worker failed');
    }, { now: new Date(Date.now() + 1000) });
    await queue.process(async () => {
      attempts += 1;
      throw new Error('worker failed again');
    }, { now: new Date(Date.now() + 1000) });

    expect(attempts).toBe(2);
    expect(queue.getDeadLetters()).toHaveLength(1);
    expect(queue.getMetrics().retried).toBe(1);
  });

  it('deduplicates successful jobs by idempotency key', async () => {
    const queue = new JobQueue({ name: 'idempotency' });
    const handled = [];

    await queue.add('Job', { id: 1 }, { idempotencyKey: 'same-key' });
    await queue.process(async (job) => handled.push(job.payload.id));
    await queue.add('Job', { id: 2 }, { idempotencyKey: 'same-key' });

    expect(handled).toEqual([1]);
    expect(queue.size()).toBe(0);
    expect(queue.getMetrics().duplicates).toBe(1);
  });

  it('publishes real payment, inventory, ledger, and order events after successful checkout transaction', async () => {
    const received = [];
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin-events@example.com',
      password: 'password123',
      role: 'admin'
    });
    const reader = await User.create({
      name: 'Reader One',
      email: 'reader-events@example.com',
      password: 'password123',
      role: 'reader'
    });
    const book = await Book.create({
      title: 'Event Book',
      slug: 'event-book',
      description: 'Event test book',
      author: admin._id,
      category: new mongoose.Types.ObjectId(),
      price: 200,
      stock: 5
    });

    for (const eventName of [
      DOMAIN_EVENTS.PAYMENT_INTENT_CREATED,
      DOMAIN_EVENTS.QR_CODE_GENERATED,
      DOMAIN_EVENTS.INVENTORY_RESERVED,
      DOMAIN_EVENTS.LEDGER_CREATED,
      DOMAIN_EVENTS.ORDER_CREATED
    ]) {
      eventBus.subscribe(eventName, async (event) => received.push(event.eventName));
    }

    await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user: reader,
      items: [{ bookId: book._id, quantity: 1 }],
      shippingAddress: {
        fullName: 'Reader One',
        addressLine1: '123 Main Street',
        city: 'Bengaluru',
        postalCode: '560001',
        country: 'India'
      },
      paymentMethod: 'UPI'
    });

    expect(received).toEqual(expect.arrayContaining([
      DOMAIN_EVENTS.PAYMENT_INTENT_CREATED,
      DOMAIN_EVENTS.QR_CODE_GENERATED,
      DOMAIN_EVENTS.INVENTORY_RESERVED,
      DOMAIN_EVENTS.LEDGER_CREATED,
      DOMAIN_EVENTS.ORDER_CREATED
    ]));
  });
});
