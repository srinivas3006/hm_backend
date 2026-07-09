const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const shipmentRepository = require('../src/repositories/shipmentRepository');
const shipmentLedgerRepository = require('../src/repositories/shipmentLedgerRepository');
const Shipment = require('../src/models/Shipment');
const ShipmentLedger = require('../src/models/ShipmentLedger');

jest.setTimeout(600000);
process.env.MONGOMS_DOWNLOAD_DIR = 'node_modules/.cache/mongodb-binaries';

describe('ShipmentRepository', () => {
  let replSet;
  let shipmentData;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Shipment.syncIndexes();
    await ShipmentLedger.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await Shipment.deleteMany({});
    await ShipmentLedger.collection.deleteMany({});
    shipmentData = {
      order: new mongoose.Types.ObjectId(),
      payment: new mongoose.Types.ObjectId(),
      invoice: new mongoose.Types.ObjectId(),
      customer: new mongoose.Types.ObjectId(),
      shippingAddress: {
        fullName: 'Reader One',
        addressLine1: '123 Main Street',
        city: 'Bengaluru',
        postalCode: '560001',
        country: 'India'
      }
    };
  });

  it('creates and finds shipments by order and tracking number', async () => {
    const shipment = await shipmentRepository.createShipment(shipmentData);
    const assigned = await shipmentRepository.assignCourier(shipment._id, {
      provider: 'manual',
      serviceName: 'Manual Courier',
      trackingNumber: 'MAN-123',
      trackingUrl: '/track/MAN-123'
    });

    expect((await shipmentRepository.findByOrder(shipmentData.order)).shipmentId).toBe(shipment.shipmentId);
    expect((await shipmentRepository.findByTrackingNumber('man-123'))._id.toString()).toBe(assigned._id.toString());
  });

  it('prevents duplicate active shipments and duplicate tracking numbers', async () => {
    const shipment = await shipmentRepository.createShipment(shipmentData);
    await shipmentRepository.assignCourier(shipment._id, { provider: 'manual', trackingNumber: 'MAN-DUP' });

    await expect(shipmentRepository.createShipment(shipmentData)).rejects.toMatchObject({ code: 'DUPLICATE_SHIPMENT' });
    await expect(shipmentRepository.createShipment({
      ...shipmentData,
      order: new mongoose.Types.ObjectId(),
      trackingNumber: 'MAN-DUP'
    })).rejects.toMatchObject({ code: 'DUPLICATE_TRACKING_NUMBER' });
  });

  it('updates status and searches shipments', async () => {
    const shipment = await shipmentRepository.createShipment(shipmentData);
    await shipmentRepository.assignCourier(shipment._id, { provider: 'manual', trackingNumber: 'MAN-SEARCH' });
    const updated = await shipmentRepository.updateStatus(shipment._id, {
      status: 'IN_TRANSIT',
      description: 'Package moved'
    });
    const search = await shipmentRepository.searchShipments({ search: 'MAN-SEARCH' }, { page: 1, limit: 5 });

    expect(updated.status).toBe('IN_TRANSIT');
    expect(updated.trackingHistory).toHaveLength(2);
    expect(search.pagination.total).toBe(1);
  });

  it('writes append-only shipment ledger entries', async () => {
    const shipment = await shipmentRepository.createShipment(shipmentData);
    const ledger = await shipmentLedgerRepository.createEntry({
      eventKey: `${shipment._id}:created`,
      shipment: shipment._id,
      order: shipment.order,
      payment: shipment.payment,
      invoice: shipment.invoice,
      customer: shipment.customer,
      eventType: 'SHIPMENT_CREATED',
      currentStatus: 'CREATED'
    });

    await expect(ShipmentLedger.findByIdAndUpdate(ledger._id, { reason: 'mutate' })).rejects.toThrow('append-only');
    expect((await shipmentLedgerRepository.listByShipment(shipment._id)).items[0].eventType).toBe('SHIPMENT_CREATED');
  });
});
