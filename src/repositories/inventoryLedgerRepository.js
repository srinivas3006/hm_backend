const mongoose = require('mongoose');
const InventoryLedger = require('../models/InventoryLedger');

class InventoryLedgerRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidInventoryLedgerIdError extends InventoryLedgerRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid inventory ledger ${field}`, 'INVALID_INVENTORY_LEDGER_ID', { field, value });
  }
}

class DuplicateInventoryLedgerEntryError extends InventoryLedgerRepositoryError {
  constructor(details = {}) {
    super('Duplicate inventory ledger entry', 'DUPLICATE_INVENTORY_LEDGER_ENTRY', details);
  }
}

class InventoryLedgerDatabaseError extends InventoryLedgerRepositoryError {
  constructor(message = 'Inventory ledger database operation failed', details = {}) {
    super(message, 'INVENTORY_LEDGER_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeObjectId = (value, field) => {
  if (!isObjectId(value)) {
    throw new InvalidInventoryLedgerIdError(value, field);
  }

  return value;
};

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
};

const applyReadOptions = (query, options = {}) => {
  if (options.session) query.session(options.session);
  if (options.projection) query.select(options.projection);
  if (options.populate) query.populate(options.populate);
  if (options.lean !== false) query.lean();

  return query;
};

const toRepositoryError = (error) => {
  if (error instanceof InventoryLedgerRepositoryError) {
    return error;
  }

  if (error && error.name === 'CastError') {
    return new InvalidInventoryLedgerIdError(error.value, error.path || 'id');
  }

  if (error && error.code === 11000) {
    return new DuplicateInventoryLedgerEntryError({
      keys: Object.keys(error.keyPattern || {}),
      values: error.keyValue || {}
    });
  }

  return new InventoryLedgerDatabaseError(
    error && error.message ? `Inventory ledger database operation failed: ${error.message}` : 'Inventory ledger database operation failed',
    { message: error && error.message }
  );
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toRepositoryError(error);
  }
};

class InventoryLedgerRepository {
  constructor(inventoryLedgerModel = InventoryLedger) {
    this.InventoryLedger = inventoryLedgerModel;
  }

  createEntry(entryData, options = {}) {
    return execute(async () => {
      const documents = await this.InventoryLedger.create([entryData], { session: options.session });
      return documents[0];
    });
  }

  listByReservation(reservationId, pagination = {}, options = {}) {
    return this.search({ reservation: reservationId, page: pagination.page, limit: pagination.limit, sort: { createdAt: 1 } }, options);
  }

  listByOrder(orderId, pagination = {}, options = {}) {
    return this.search({ order: orderId, page: pagination.page, limit: pagination.limit, sort: { createdAt: 1 } }, options);
  }

  listByPayment(paymentId, pagination = {}, options = {}) {
    return this.search({ payment: paymentId, page: pagination.page, limit: pagination.limit, sort: { createdAt: 1 } }, options);
  }

  listByBook(bookId, pagination = {}, options = {}) {
    return this.search({ book: bookId, page: pagination.page, limit: pagination.limit, sort: { createdAt: -1 } }, options);
  }

  listByEvent(eventType, pagination = {}, options = {}) {
    return this.search({ eventType, page: pagination.page, limit: pagination.limit, sort: { createdAt: -1 } }, options);
  }

  search(filters = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(filters);

    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(
        this.InventoryLedger.find(query).sort(filters.sort || { createdAt: -1 }).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.InventoryLedger.countDocuments(query).session(options.session || null);
      const [items, total] = options.session
        ? [await itemsQuery, await totalQuery]
        : await Promise.all([itemsQuery, totalQuery]);

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    });
  }

  buildFilter(filters = {}) {
    const query = {};

    if (filters.reservation) query.reservation = normalizeObjectId(filters.reservation, 'reservation');
    if (filters.order) query.order = normalizeObjectId(filters.order, 'order');
    if (filters.payment) query.payment = normalizeObjectId(filters.payment, 'payment');
    if (filters.book) query.book = normalizeObjectId(filters.book, 'book');
    if (filters.eventType) query.eventType = String(filters.eventType).trim().toUpperCase();

    return query;
  }
}

module.exports = new InventoryLedgerRepository();
module.exports.InventoryLedgerRepository = InventoryLedgerRepository;
module.exports.InventoryLedgerRepositoryError = InventoryLedgerRepositoryError;
module.exports.InvalidInventoryLedgerIdError = InvalidInventoryLedgerIdError;
module.exports.DuplicateInventoryLedgerEntryError = DuplicateInventoryLedgerEntryError;
module.exports.InventoryLedgerDatabaseError = InventoryLedgerDatabaseError;
