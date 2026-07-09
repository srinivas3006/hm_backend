jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const invoiceService = require('../src/services/invoiceService');
const invoicePdfGenerator = require('../src/invoices/pdf/invoicePdfGenerator');
const eventBus = require('../src/events/eventBus');
const { DOMAIN_EVENTS } = require('../src/events/eventCatalog');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Book = require('../src/models/Book');
const Payment = require('../src/models/Payment');
const Invoice = require('../src/models/Invoice');
const Counter = require('../src/models/Counter');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('InvoiceService', () => {
  let replSet;
  let user;
  let book;
  let order;
  let payment;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([
      User.syncIndexes(),
      Order.syncIndexes(),
      Book.syncIndexes(),
      Payment.syncIndexes(),
      Invoice.syncIndexes(),
      Counter.syncIndexes()
    ]);
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
    await Counter.deleteMany({});

    user = await User.create({
      name: 'Invoice Reader',
      email: 'invoice-reader@example.com',
      password: 'password123',
      role: 'reader'
    });
    book = await Book.create({
      title: 'Invoice Book',
      description: 'Invoice service book',
      author: user._id,
      category: new mongoose.Types.ObjectId(),
      price: 200,
      stock: 5
    });
    order = await Order.create({
      orderNumber: 'HM-INVOICE',
      user: user._id,
      items: [{ book: book._id, quantity: 1, price: 200 }],
      shippingAddress: {
        fullName: 'Invoice Reader',
        addressLine1: '123 Main Street',
        city: 'Bengaluru',
        postalCode: '560001',
        country: 'India'
      },
      subtotal: 200,
      tax: 10,
      shippingPrice: 50,
      totalPrice: 260,
      isPaid: true,
      paymentMethod: 'UPI',
      paidAt: new Date()
    });
    payment = await Payment.create({
      order: order._id,
      user: user._id,
      amount: 260,
      currency: 'INR',
      paymentMethod: 'UPI',
      provider: 'manual_upi',
      status: 'PAYMENT_VERIFIED',
      successfulPayment: true,
      activeIntent: false,
      verifiedAt: new Date()
    });
    order.payment = payment._id;
    await order.save();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('generates an invoice only for verified payments and publishes InvoiceGenerated', async () => {
    const received = [];
    eventBus.subscribe(DOMAIN_EVENTS.INVOICE_GENERATED, async (event) => received.push(event.payload.invoiceNumber));

    const invoice = await invoiceService.generateForPayment(payment._id, {
      now: new Date('2026-07-09T00:00:00.000Z')
    });

    expect(invoice.invoiceNumber).toBe('INV-202607-000001');
    expect(invoice.total).toBe(260);
    expect(invoice.items[0].title).toBe('Invoice Book');
    expect(received).toEqual([invoice.invoiceNumber]);
  });

  it('prevents duplicate invoices by returning the existing invoice', async () => {
    const first = await invoiceService.generateForPayment(payment._id);
    const second = await invoiceService.generateForPayment(payment._id);

    expect(String(second._id)).toBe(String(first._id));
    expect(await Invoice.countDocuments()).toBe(1);
  });

  it('rejects invoice generation for unverified payments', async () => {
    payment.status = 'VERIFICATION_PENDING';
    payment.successfulPayment = false;
    await payment.save();

    await expect(invoiceService.generateForPayment(payment._id))
      .rejects.toMatchObject({ code: 'INVOICE_GENERATION_NOT_ALLOWED' });
  });

  it('supports transaction rollback without publishing InvoiceGenerated', async () => {
    const received = [];
    eventBus.subscribe(DOMAIN_EVENTS.INVOICE_GENERATED, async (event) => received.push(event.eventName));

    await expect(invoiceService.withTransaction(async (session) => {
      await invoiceService.generateForPayment(payment._id, { session });
      throw new Error('abort invoice');
    })).rejects.toThrow('abort invoice');

    expect(await Invoice.countDocuments()).toBe(0);
    expect(received).toEqual([]);
  });

  it('generates a reusable PDF document abstraction', async () => {
    const invoice = await invoiceService.generateForPayment(payment._id);
    const document = await invoiceService.getInvoiceDocument(invoice._id);
    const generated = await invoicePdfGenerator.generate(invoice.toObject());

    expect(document.contentType).toBe('application/pdf');
    expect(document.fileName).toBe(`${invoice.invoiceNumber}.pdf`);
    expect(document.buffer.toString('utf8', 0, 8)).toBe('%PDF-1.4');
    expect(generated.checksum).toHaveLength(64);
  });
});
