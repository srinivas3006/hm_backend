const ShipmentLedger = require('../models/ShipmentLedger');

class ShipmentLedgerRepositoryError extends Error {
  constructor(message = 'Shipment ledger database operation failed', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = 'SHIPMENT_LEDGER_DATABASE_ERROR';
    this.details = details;
  }
}

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error && error.code === 11000) return null;
    throw new ShipmentLedgerRepositoryError(
      error && error.message ? `Shipment ledger database operation failed: ${error.message}` : undefined,
      { message: error && error.message }
    );
  }
};

class ShipmentLedgerRepository {
  constructor(model = ShipmentLedger) {
    this.ShipmentLedger = model;
  }

  createEntry(data, options = {}) {
    return execute(async () => {
      const documents = await this.ShipmentLedger.create([data], { session: options.session });
      return documents[0];
    });
  }

  listByShipment(shipmentId, pagination = {}, options = {}) {
    return this.search({ shipment: shipmentId }, pagination, options);
  }

  listByOrder(orderId, pagination = {}, options = {}) {
    return this.search({ order: orderId }, pagination, options);
  }

  search(filters = {}, pagination = {}, options = {}) {
    const page = Math.max(parseInt(pagination.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(pagination.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    return execute(async () => {
      const query = {};
      if (filters.shipment) query.shipment = filters.shipment;
      if (filters.order) query.order = filters.order;
      if (filters.eventType) query.eventType = filters.eventType;
      const itemsQuery = this.ShipmentLedger.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).lean();
      const totalQuery = this.ShipmentLedger.countDocuments(query);
      if (options.session) {
        itemsQuery.session(options.session);
        totalQuery.session(options.session);
      }
      const [items, total] = await Promise.all([itemsQuery, totalQuery]);
      return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
    });
  }
}

module.exports = new ShipmentLedgerRepository();
module.exports.ShipmentLedgerRepository = ShipmentLedgerRepository;
module.exports.ShipmentLedgerRepositoryError = ShipmentLedgerRepositoryError;
