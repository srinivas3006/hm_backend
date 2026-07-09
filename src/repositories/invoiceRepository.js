const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');

class InvoiceRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidInvoiceIdError extends InvoiceRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid invoice ${field}`, 'INVALID_INVOICE_ID', { field, value });
  }
}

class InvoiceNotFoundError extends InvoiceRepositoryError {
  constructor(criteria = {}) {
    super('Invoice not found', 'INVOICE_NOT_FOUND', { criteria });
  }
}

class DuplicateInvoiceError extends InvoiceRepositoryError {
  constructor(message = 'Duplicate invoice', details = {}) {
    super(message, 'DUPLICATE_INVOICE', details);
  }
}

class InvoiceDatabaseError extends InvoiceRepositoryError {
  constructor(message = 'Invoice database operation failed', details = {}) {
    super(message, 'INVOICE_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
};

const normalizeObjectId = (value, field = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new InvalidInvoiceIdError(value, field);
  }
  return value;
};

const applyReadOptions = (query, options = {}) => {
  if (options.session) query.session(options.session);
  if (options.projection) query.select(options.projection);
  if (options.includeDocument) query.select('+document.data');
  if (options.populate) query.populate(options.populate);
  if (options.lean !== false) query.lean();
  return query;
};

const toRepositoryError = (error) => {
  if (error instanceof InvoiceRepositoryError) return error;

  if (error && error.name === 'CastError') {
    return new InvalidInvoiceIdError(error.value, error.path || 'id');
  }

  if (error && error.code === 11000) {
    const keys = Object.keys(error.keyPattern || {});
    const values = error.keyValue || {};
    return new DuplicateInvoiceError('Invoice already exists for this reference', { keys, values });
  }

  return new InvoiceDatabaseError('Invoice database operation failed', {
    message: error && error.message
  });
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toRepositoryError(error);
  }
};

class InvoiceRepository {
  constructor(invoiceModel = Invoice, counterModel = Counter) {
    this.Invoice = invoiceModel;
    this.Counter = counterModel;
  }

  createInvoice(invoiceData, options = {}) {
    return execute(async () => {
      const documents = await this.Invoice.create([invoiceData], { session: options.session });
      return documents[0];
    });
  }

  nextSequence(key, options = {}) {
    return execute(async () => this.Counter.findOneAndUpdate(
      { key },
      { $inc: { sequence: 1 } },
      {
        returnDocument: 'after',
        upsert: true,
        session: options.session,
        setDefaultsOnInsert: true
      }
    ));
  }

  findById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      return applyReadOptions(this.Invoice.findById(id), options);
    });
  }

  getById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const invoice = await applyReadOptions(this.Invoice.findById(id), options);
      if (!invoice) throw new InvoiceNotFoundError({ id });
      return invoice;
    });
  }

  findByOrder(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Invoice.findOne({ order: normalizeObjectId(orderId, 'order') }),
      options
    ));
  }

  findByPayment(paymentId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Invoice.findOne({ payment: normalizeObjectId(paymentId, 'payment') }),
      options
    ));
  }

  findByInvoiceNumber(invoiceNumber, options = {}) {
    return execute(async () => applyReadOptions(
      this.Invoice.findOne({ invoiceNumber: String(invoiceNumber).trim().toUpperCase() }),
      options
    ));
  }

  listInvoices(filters = {}, pagination = {}, options = {}) {
    return this.searchInvoices(filters, pagination, options);
  }

  searchInvoices(filters = {}, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);
    const sort = options.sort || filters.sort || { generatedAt: -1 };

    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(
        this.Invoice.find(query).sort(sort).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Invoice.countDocuments(query).session(options.session || null);
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

    if (filters.id) query._id = normalizeObjectId(filters.id);
    if (filters.order) query.order = normalizeObjectId(filters.order, 'order');
    if (filters.payment) query.payment = normalizeObjectId(filters.payment, 'payment');
    if (filters.customer) query.customer = normalizeObjectId(filters.customer, 'customer');
    if (filters.invoiceNumber) query.invoiceNumber = String(filters.invoiceNumber).trim().toUpperCase();
    if (filters.status) query.status = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      query.generatedAt = {};
      if (filters.dateFrom) query.generatedAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.generatedAt.$lte = new Date(filters.dateTo);
    }

    if (filters.amountMin || filters.amountMax) {
      query.total = {};
      if (filters.amountMin) query.total.$gte = Number(filters.amountMin);
      if (filters.amountMax) query.total.$lte = Number(filters.amountMax);
    }

    if (filters.search) {
      const term = String(filters.search).trim();
      query.$or = [
        { invoiceNumber: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { invoiceId: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ];
    }

    return query;
  }
}

module.exports = new InvoiceRepository();
module.exports.InvoiceRepository = InvoiceRepository;
module.exports.InvoiceRepositoryError = InvoiceRepositoryError;
module.exports.InvalidInvoiceIdError = InvalidInvoiceIdError;
module.exports.InvoiceNotFoundError = InvoiceNotFoundError;
module.exports.DuplicateInvoiceError = DuplicateInvoiceError;
module.exports.InvoiceDatabaseError = InvoiceDatabaseError;
