jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const inventoryService = require('../src/services/inventoryService');
const inventoryRepository = require('../src/repositories/inventoryRepository');
const inventoryLedgerRepository = require('../src/repositories/inventoryLedgerRepository');
const Book = require('../src/models/Book');
const InventoryReservation = require('../src/models/InventoryReservation');
const InventoryLedger = require('../src/models/InventoryLedger');

const {
  InventoryReservationError,
  InventoryDeductionError
} = require('../src/services/inventoryService');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('InventoryService reservation engine', () => {
  let replSet;
  let orderId;
  let paymentId;
  let userId;
  let book;

  const order = () => ({ _id: orderId });
  const payment = (overrides = {}) => ({
    _id: paymentId,
    expiresAt: new Date(Date.now() + 60000),
    ...overrides
  });

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    await mongoose.connect(replSet.getUri());
    await Book.syncIndexes();
    await InventoryReservation.syncIndexes();
    await InventoryLedger.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    orderId = new mongoose.Types.ObjectId();
    paymentId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
    await Book.deleteMany({});
    await InventoryReservation.deleteMany({});
    await InventoryLedger.collection.deleteMany({});
    book = await Book.create({
      title: 'Inventory Book',
      description: 'Inventory test',
      author: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      price: 250,
      stock: 3,
      reservedStock: 0
    });
  });

  it('reserves stock without deducting physical stock and writes ledger', async () => {
    const reservations = await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 2 }]
    }, {
      actor: { userId },
      actorType: 'CUSTOMER'
    });

    const updatedBook = await Book.findById(book._id).lean();
    const ledger = await inventoryLedgerRepository.listByReservation(reservations[0]._id);

    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe('RESERVED');
    expect(updatedBook.stock).toBe(3);
    expect(updatedBook.reservedStock).toBe(2);
    expect(ledger.items[0].eventType).toBe('RESERVED');
  });

  it('prevents overselling with concurrent reservations', async () => {
    const results = await Promise.allSettled([
      inventoryService.reserveOrderItems({
        order: order(),
        payment: payment(),
        items: [{ book: book._id, quantity: 2 }]
      }),
      inventoryService.reserveOrderItems({
        order: { _id: new mongoose.Types.ObjectId() },
        payment: { _id: new mongoose.Types.ObjectId(), expiresAt: new Date(Date.now() + 60000) },
        items: [{ book: book._id, quantity: 2 }]
      })
    ]);
    const updatedBook = await Book.findById(book._id).lean();

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason)
      .toBeInstanceOf(InventoryReservationError);
    expect(updatedBook.stock).toBe(3);
    expect(updatedBook.reservedStock).toBe(2);
  });

  it('deducts stock after payment verification', async () => {
    const [reservation] = await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 2 }]
    });

    const [deducted] = await inventoryService.deductByPayment(paymentId, {
      actor: { userId },
      actorType: 'ADMIN'
    });
    const updatedBook = await Book.findById(book._id).lean();
    const ledger = await inventoryLedgerRepository.listByReservation(reservation._id);

    expect(deducted.status).toBe('DEDUCTED');
    expect(updatedBook.stock).toBe(1);
    expect(updatedBook.reservedStock).toBe(0);
    expect(ledger.items.map((entry) => entry.eventType)).toEqual(['RESERVED', 'DEDUCTED']);
  });

  it('releases reservations after rejection, expiry, or cancellation', async () => {
    await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 1 }]
    });

    const [released] = await inventoryService.releaseByPayment(paymentId, {
      reason: 'Payment rejected'
    });
    const updatedBook = await Book.findById(book._id).lean();

    expect(released.status).toBe('RELEASED');
    expect(updatedBook.stock).toBe(3);
    expect(updatedBook.reservedStock).toBe(0);
  });

  it('expires stale reservations', async () => {
    await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment({ expiresAt: new Date(Date.now() - 1000) }),
      items: [{ book: book._id, quantity: 1 }]
    }, {
      expiresAt: new Date(Date.now() - 1000)
    });

    const expired = await inventoryService.expireReservations(new Date());
    const updatedBook = await Book.findById(book._id).lean();

    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe('EXPIRED');
    expect(updatedBook.reservedStock).toBe(0);
  });

  it('prevents duplicate active reservations for the same order payment and book', async () => {
    await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 1 }]
    });

    await expect(inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 1 }]
    })).rejects.toBeInstanceOf(InventoryReservationError);
  });

  it('rolls back reservation and ledger writes in an aborted transaction', async () => {
    const session = await mongoose.startSession();

    await expect(session.withTransaction(async () => {
      await inventoryService.reserveOrderItems({
        order: order(),
        payment: payment(),
        items: [{ book: book._id, quantity: 1 }]
      }, { session });
      throw new Error('abort inventory reservation');
    })).rejects.toThrow('abort inventory reservation');

    await session.endSession();

    const updatedBook = await Book.findById(book._id).lean();
    expect(await InventoryReservation.countDocuments()).toBe(0);
    expect(await InventoryLedger.countDocuments()).toBe(0);
    expect(updatedBook.reservedStock).toBe(0);
  });

  it('blocks double deduction of a reservation', async () => {
    const [reservation] = await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 1 }]
    });
    await inventoryService.confirmDeduction(reservation._id);

    await expect(inventoryService.confirmDeduction(reservation._id))
      .rejects.toBeInstanceOf(InventoryDeductionError);
  });

  it('supports repository low-stock and reservation searches', async () => {
    await inventoryService.reserveOrderItems({
      order: order(),
      payment: payment(),
      items: [{ book: book._id, quantity: 3 }]
    });

    const lowStock = await inventoryRepository.findLowStock(0);
    const reservations = await inventoryRepository.findReservations({ order: orderId });

    expect(lowStock.pagination.total).toBe(1);
    expect(reservations.pagination.total).toBe(1);
  });
});
