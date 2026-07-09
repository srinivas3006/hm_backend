const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const invoiceRepository = require('../src/repositories/invoiceRepository');
const Invoice = require('../src/models/Invoice');
const Counter = require('../src/models/Counter');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('InvoiceRepository', () => {
  let replSet;
  let invoiceData;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Invoice.syncIndexes();
    await Counter.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Invoice.deleteMany({});
    await Counter.deleteMany({});
    invoiceData = {
      invoiceNumber: 'INV-202607-000001',
      order: new mongoose.Types.ObjectId(),
      payment: new mongoose.Types.ObjectId(),
      customer: new mongoose.Types.ObjectId(),
      items: [{
        book: new mongoose.Types.ObjectId(),
        title: 'Repository Book',
        quantity: 1,
        unitPrice: 200,
        taxAmount: 10,
        lineTotal: 210
      }],
      subtotal: 200,
      taxTotal: 10,
      discountTotal: 0,
      shippingTotal: 50,
      total: 260,
      currency: 'INR',
      document: {
        contentType: 'application/pdf',
        fileName: 'INV-202607-000001.pdf',
        data: Buffer.from('%PDF-1.4'),
        generatedAt: new Date(),
        checksum: 'checksum'
      }
    };
  });

  it('creates and finds invoices by order, payment, and invoice number', async () => {
    const invoice = await invoiceRepository.createInvoice(invoiceData);

    expect((await invoiceRepository.findByOrder(invoiceData.order)).invoiceNumber).toBe(invoice.invoiceNumber);
    expect((await invoiceRepository.findByPayment(invoiceData.payment)).invoiceNumber).toBe(invoice.invoiceNumber);
    expect((await invoiceRepository.findByInvoiceNumber('inv-202607-000001')).invoiceNumber).toBe(invoice.invoiceNumber);
  });

  it('lists and searches invoices with pagination', async () => {
    await invoiceRepository.createInvoice(invoiceData);

    const list = await invoiceRepository.listInvoices({}, { page: 1, limit: 5 });
    const search = await invoiceRepository.searchInvoices({ search: '202607' }, { page: 1, limit: 5 });

    expect(list.pagination.total).toBe(1);
    expect(search.items[0].invoiceNumber).toBe('INV-202607-000001');
  });

  it('prevents duplicate order or payment invoices', async () => {
    await invoiceRepository.createInvoice(invoiceData);

    await expect(invoiceRepository.createInvoice({
      ...invoiceData,
      invoiceNumber: 'INV-202607-000002'
    })).rejects.toMatchObject({ code: 'DUPLICATE_INVOICE' });
  });

  it('increments invoice counters atomically under concurrency', async () => {
    const results = await Promise.all([
      invoiceRepository.nextSequence('invoice:2026:07'),
      invoiceRepository.nextSequence('invoice:2026:07'),
      invoiceRepository.nextSequence('invoice:2026:07')
    ]);

    expect(results.map((counter) => counter.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('rolls back invoice and counter writes in a transaction', async () => {
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await invoiceRepository.nextSequence('invoice:2026:07', { session });
      await invoiceRepository.createInvoice(invoiceData, { session });
      throw new Error('rollback invoice');
    })).rejects.toThrow('rollback invoice');
    session.endSession();

    expect(await Invoice.countDocuments()).toBe(0);
    expect(await Counter.countDocuments()).toBe(0);
  });
});
