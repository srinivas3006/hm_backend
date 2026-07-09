const mongoose = require('mongoose');
const PaymentLedger = require('../models/PaymentLedger');

class PaymentLedgerRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidPaymentLedgerIdError extends PaymentLedgerRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid payment ledger ${field}`, 'INVALID_PAYMENT_LEDGER_ID', { field, value });
  }
}

class DuplicatePaymentLedgerEntryError extends PaymentLedgerRepositoryError {
  constructor(details = {}) {
    super('Duplicate payment ledger entry', 'DUPLICATE_PAYMENT_LEDGER_ENTRY', details);
  }
}

class PaymentLedgerDatabaseError extends PaymentLedgerRepositoryError {
  constructor(message = 'Payment ledger database operation failed', details = {}) {
    super(message, 'PAYMENT_LEDGER_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeObjectId = (value, field) => {
  if (!isObjectId(value)) {
    throw new InvalidPaymentLedgerIdError(value, field);
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
  if (error instanceof PaymentLedgerRepositoryError) {
    return error;
  }

  if (error && error.name === 'CastError') {
    return new InvalidPaymentLedgerIdError(error.value, error.path || 'id');
  }

  if (error && error.code === 11000) {
    return new DuplicatePaymentLedgerEntryError({
      keys: Object.keys(error.keyPattern || {}),
      values: error.keyValue || {}
    });
  }

  return new PaymentLedgerDatabaseError(
    error && error.message ? `Payment ledger database operation failed: ${error.message}` : 'Payment ledger database operation failed',
    {
    message: error && error.message
    }
  );
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toRepositoryError(error);
  }
};

class PaymentLedgerRepository {
  constructor(paymentLedgerModel = PaymentLedger) {
    this.PaymentLedger = paymentLedgerModel;
  }

  createEntry(entryData, options = {}) {
    return execute(async () => {
      const documents = await this.PaymentLedger.create([entryData], { session: options.session });
      return documents[0];
    });
  }

  listByPayment(paymentId, pagination = {}, options = {}) {
    return this.search({
      paymentId,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: 1 }
    }, options);
  }

  listByOrder(orderId, pagination = {}, options = {}) {
    return this.search({
      orderId,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: 1 }
    }, options);
  }

  listByUser(userId, pagination = {}, options = {}) {
    return this.search({
      userId,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  listByEvent(eventType, pagination = {}, options = {}) {
    return this.search({
      eventType,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  listByDateRange(dateRange = {}, pagination = {}, options = {}) {
    return this.search({
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  search(filters = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(filters);
    const sort = filters.sort || { createdAt: -1 };

    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(
        this.PaymentLedger.find(query).sort(sort).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.PaymentLedger.countDocuments(query).session(options.session || null);
      const items = options.session ? await itemsQuery : null;
      const total = options.session ? await totalQuery : null;
      const [parallelItems, parallelTotal] = options.session ? [items, total] : await Promise.all([itemsQuery, totalQuery]);

      return {
        items: parallelItems,
        pagination: {
          total: parallelTotal,
          page,
          limit,
          pages: Math.ceil(parallelTotal / limit)
        }
      };
    });
  }

  buildFilter(filters = {}) {
    const query = {};

    if (filters.paymentId) query.paymentId = normalizeObjectId(filters.paymentId, 'paymentId');
    if (filters.orderId) query.orderId = normalizeObjectId(filters.orderId, 'orderId');
    if (filters.userId) query.userId = normalizeObjectId(filters.userId, 'userId');
    if (filters.eventType) query.eventType = String(filters.eventType).trim().toUpperCase();
    if (filters.eventTypes && filters.eventTypes.length) {
      query.eventType = { $in: filters.eventTypes.map((eventType) => String(eventType).trim().toUpperCase()) };
    }
    if (filters.provider) query.provider = String(filters.provider).trim().toLowerCase();
    if (filters.reference) query.reference = String(filters.reference).trim();

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    return query;
  }
}

module.exports = new PaymentLedgerRepository();
module.exports.PaymentLedgerRepository = PaymentLedgerRepository;
module.exports.PaymentLedgerRepositoryError = PaymentLedgerRepositoryError;
module.exports.InvalidPaymentLedgerIdError = InvalidPaymentLedgerIdError;
module.exports.DuplicatePaymentLedgerEntryError = DuplicatePaymentLedgerEntryError;
module.exports.PaymentLedgerDatabaseError = PaymentLedgerDatabaseError;
