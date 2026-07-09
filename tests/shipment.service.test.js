jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const shipmentService = require('../src/services/shipmentService');
const eventBus = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const Invoice = require('../src/models/Invoice');
const Shipment = require('../src/models/Shipment');
const ShipmentLedger = require('../src/models/ShipmentLedger');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('ShipmentService', () => {
  let replSet;
  let user;
  let order;
  let payment;
  let invoice;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([User.syncIndexes(), Order.syncIndexes(), Book.syncIndexes(), Payment.syncIndexes(), Invoice.syncIndexes(), Shipment.syncIndexes(), ShipmentLedger.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    eventBus.reset();
    await User.deleteMany({});
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await Invoice.deleteMany({});
    await Shipment.deleteMany({});
    await ShipmentLedger.collection.deleteMany({});

    user = await User.create({ name: 'Reader One', email: 'ship-reader@example.com', password: 'password123', role: 'reader' });
    const book = await Book.create({ title: 'Ship Book', description: 'Ship book', author: user._id, category: new mongoose.Types.ObjectId(), price: 100, stock: 5 });
    order = await Order.create({
      orderNumber: 'HM-SHIP',
      user: user._id,
      items: [{ book: book._id, quantity: 1, price: 100 }],
      shippingAddress: { fullName: 'Reader One', addressLine1: '123 Main Street', city: 'Bengaluru', postalCode: '560001', country: 'India' },
      subtotal: 100,
      tax: 5,
      shippingPrice: 50,
      totalPrice: 155,
      isPaid: true,
      paidAt: new Date()
    });
    payment = await Payment.create({ order: order._id, user: user._id, amount: 155, currency: 'INR', paymentMethod: 'UPI', provider: 'manual_upi', status: 'PAYMENT_VERIFIED', successfulPayment: true });
    invoice = await Invoice.create({
      invoiceNumber: 'INV-202607-000001',
      order: order._id,
      payment: payment._id,
      customer: user._id,
      items: [{ book: book._id, title: 'Ship Book', quantity: 1, unitPrice: 100, lineTotal: 105 }],
      subtotal: 100,
      taxTotal: 5,
      discountTotal: 0,
      shippingTotal: 50,
      total: 155,
      status: 'GENERATED'
    });
  });

  afterEach(() => eventBus.reset());

  it('creates shipment after verified payment and generated invoice, then prevents duplicates', async () => {
    const events = [];
    eventBus.subscribe(DOMAIN_EVENTS.SHIPMENT_CREATED, async (event) => events.push(event.eventName));

    const shipment = await shipmentService.createShipmentForInvoice(invoice._id);
    const duplicate = await shipmentService.createShipmentForInvoice(invoice._id);

    expect(shipment.status).toBe('CREATED');
    expect(String(duplicate._id)).toBe(String(shipment._id));
    expect(await Shipment.countDocuments()).toBe(1);
    expect(events).toEqual([DOMAIN_EVENTS.SHIPMENT_CREATED]);
    expect((await ShipmentLedger.findOne({ shipment: shipment._id })).eventType).toBe('SHIPMENT_CREATED');
  });

  it('assigns manual courier and updates shipment status through valid transitions', async () => {
    const shipment = await shipmentService.createShipmentForInvoice(invoice._id);
    const assigned = await shipmentService.assignCourier(shipment._id, { provider: 'manual', trackingNumber: 'MAN-SVC' });
    const transit = await shipmentService.updateStatus(shipment._id, { status: 'IN_TRANSIT', description: 'Dispatched' });
    const delivered = await shipmentService.updateStatus(shipment._id, { status: 'DELIVERED', description: 'Delivered' });
    const syncedOrder = await Order.findById(order._id).lean();

    expect(assigned.trackingNumber).toBe('MAN-SVC');
    expect(transit.status).toBe('IN_TRANSIT');
    expect(delivered.deliveryDate).toBeTruthy();
    expect(syncedOrder.status).toBe('DELIVERED');
  });

  it('rejects invalid transitions and rolls back transactional shipment creation', async () => {
    const shipment = await shipmentService.createShipmentForInvoice(invoice._id);
    await expect(shipmentService.updateStatus(shipment._id, { status: 'DELIVERED' })).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_TRANSITION' });

    await Shipment.deleteMany({});
    await ShipmentLedger.collection.deleteMany({});
    await expect(shipmentService.withTransaction(async (session) => {
      await shipmentService.createShipmentForInvoice(invoice._id, { session });
      throw new Error('abort shipment');
    })).rejects.toThrow('abort shipment');

    expect(await Shipment.countDocuments()).toBe(0);
    expect(await ShipmentLedger.countDocuments()).toBe(0);
  });
});
