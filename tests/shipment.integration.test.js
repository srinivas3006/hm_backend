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
const orderRoutes = require('../src/routes/orderRoutes');
const eventBus = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const { registerShipmentSubscriber, resetShipmentSubscriberRegistration } = require('../src/events/shipmentSubscriber');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const Invoice = require('../src/models/Invoice');
const Shipment = require('../src/models/Shipment');
const ShipmentLedger = require('../src/models/ShipmentLedger');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('Shipment integration', () => {
  let replSet;
  let app;
  let admin;
  let reader;
  let order;
  let payment;
  let invoice;
  let adminToken;
  let readerToken;

  const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123');

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([User.syncIndexes(), Order.syncIndexes(), Book.syncIndexes(), Payment.syncIndexes(), Invoice.syncIndexes(), Shipment.syncIndexes(), ShipmentLedger.syncIndexes()]);
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use('/api/orders', orderRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    eventBus.reset();
    resetShipmentSubscriberRegistration();
    registerShipmentSubscriber();
    await User.deleteMany({});
    await Order.deleteMany({});
    await Book.deleteMany({});
    await Payment.deleteMany({});
    await Invoice.deleteMany({});
    await Shipment.deleteMany({});
    await ShipmentLedger.collection.deleteMany({});

    admin = await User.create({ name: 'Admin User', email: 'admin-ship@example.com', password: 'password123', role: 'admin' });
    reader = await User.create({ name: 'Reader One', email: 'reader-ship@example.com', password: 'password123', role: 'reader' });
    const book = await Book.create({ title: 'Ship Integration Book', slug: 'ship-integration-book', description: 'Ship book', author: admin._id, category: new mongoose.Types.ObjectId(), price: 100, stock: 5 });
    order = await Order.create({
      orderNumber: 'HM-SHIP-INT',
      user: reader._id,
      items: [{ book: book._id, quantity: 1, price: 100 }],
      shippingAddress: { fullName: 'Reader One', addressLine1: '123 Main Street', city: 'Bengaluru', postalCode: '560001', country: 'India' },
      subtotal: 100,
      tax: 5,
      shippingPrice: 50,
      totalPrice: 155,
      isPaid: true,
      paidAt: new Date()
    });
    payment = await Payment.create({ order: order._id, user: reader._id, amount: 155, currency: 'INR', paymentMethod: 'UPI', provider: 'manual_upi', status: 'PAYMENT_VERIFIED', successfulPayment: true });
    invoice = await Invoice.create({
      invoiceNumber: 'INV-202607-000010',
      order: order._id,
      payment: payment._id,
      customer: reader._id,
      items: [{ book: book._id, title: 'Ship Integration Book', quantity: 1, unitPrice: 100, lineTotal: 105 }],
      subtotal: 100,
      taxTotal: 5,
      discountTotal: 0,
      shippingTotal: 50,
      total: 155,
      status: 'GENERATED'
    });
    adminToken = tokenFor(admin);
    readerToken = tokenFor(reader);
  });

  afterEach(() => {
    eventBus.reset();
    resetShipmentSubscriberRegistration();
  });

  const publishInvoiceGenerated = () => eventBus.publish(DOMAIN_EVENTS.INVOICE_GENERATED, {
    invoiceId: invoice.invoiceId,
    invoiceObjectId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    orderId: String(order._id),
    paymentId: String(payment._id),
    customerId: String(reader._id)
  }, {
    eventId: 'invoice-generated-for-shipment',
    idempotencyKey: `invoice-generated:${invoice._id}`
  });

  it('creates a shipment from InvoiceGenerated and prevents duplicate replay', async () => {
    await publishInvoiceGenerated();
    await publishInvoiceGenerated();
    const shipment = await Shipment.findOne({ order: order._id }).lean();

    expect(shipment).toBeTruthy();
    expect(shipment.status).toBe('CREATED');
    expect(await Shipment.countDocuments({ order: order._id })).toBe(1);
    expect(await ShipmentLedger.countDocuments({ shipment: shipment._id })).toBe(1);
  });

  it('serves admin shipment list, search, detail, courier assignment, status update, and tracking APIs', async () => {
    await publishInvoiceGenerated();
    const shipment = await Shipment.findOne({ order: order._id }).lean();

    const list = await request(app).get('/api/admin/shipments').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const search = await request(app).get('/api/admin/shipments/search?q=Reader').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const detail = await request(app).get(`/api/admin/shipments/${shipment._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const assigned = await request(app)
      .post(`/api/admin/shipments/${shipment._id}/assign-courier`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provider: 'manual', trackingNumber: 'MAN-INT' })
      .expect(200);
    const transit = await request(app)
      .post(`/api/admin/shipments/${shipment._id}/update-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_TRANSIT', description: 'Dispatched' })
      .expect(200);
    const tracking = await request(app).get(`/api/admin/shipments/${shipment._id}/tracking`).set('Authorization', `Bearer ${adminToken}`).expect(200);

    expect(list.body.data.pagination.total).toBe(1);
    expect(search.body.data.pagination.total).toBe(1);
    expect(detail.body.data.shipmentId).toBe(shipment.shipmentId);
    expect(assigned.body.data.trackingNumber).toBe('MAN-INT');
    expect(transit.body.data.status).toBe('IN_TRANSIT');
    expect(tracking.body.data.trackingHistory.length).toBeGreaterThanOrEqual(3);
  });

  it('serves customer shipment and tracking APIs with ownership checks', async () => {
    await publishInvoiceGenerated();
    const shipment = await Shipment.findOne({ order: order._id }).lean();

    const customerShipment = await request(app).get(`/api/orders/${order._id}/shipment`).set('Authorization', `Bearer ${readerToken}`).expect(200);
    const customerTracking = await request(app).get(`/api/orders/${order._id}/tracking`).set('Authorization', `Bearer ${readerToken}`).expect(200);

    const stranger = await User.create({ name: 'Stranger', email: 'stranger-ship@example.com', password: 'password123', role: 'reader' });
    await request(app).get(`/api/orders/${order._id}/shipment`).set('Authorization', `Bearer ${tokenFor(stranger)}`).expect(403);

    expect(customerShipment.body.data.shipmentId).toBe(shipment.shipmentId);
    expect(customerTracking.body.data.shipment.shipmentId).toBe(shipment.shipmentId);
  });
});
