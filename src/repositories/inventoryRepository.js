const mongoose = require('mongoose');
const Book = require('../models/Book');
const InventoryReservation = require('../models/InventoryReservation');

class InventoryRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidInventoryIdError extends InventoryRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid inventory ${field}`, 'INVALID_INVENTORY_ID', { field, value });
  }
}

class InventoryReservationNotFoundError extends InventoryRepositoryError {
  constructor(criteria = {}) {
    super('Inventory reservation not found', 'INVENTORY_RESERVATION_NOT_FOUND', { criteria });
  }
}

class DuplicateInventoryReservationError extends InventoryRepositoryError {
  constructor(details = {}) {
    super('Duplicate inventory reservation', 'DUPLICATE_INVENTORY_RESERVATION', details);
  }
}

class InsufficientInventoryError extends InventoryRepositoryError {
  constructor(details = {}) {
    super('Insufficient inventory available', 'INSUFFICIENT_INVENTORY', details);
  }
}

class InventoryDatabaseError extends InventoryRepositoryError {
  constructor(message = 'Inventory database operation failed', details = {}) {
    super(message, 'INVENTORY_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeObjectId = (value, field) => {
  if (!isObjectId(value)) {
    throw new InvalidInventoryIdError(value, field);
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
  if (error instanceof InventoryRepositoryError) {
    return error;
  }

  if (error && error.name === 'CastError') {
    return new InvalidInventoryIdError(error.value, error.path || 'id');
  }

  if (error && error.code === 11000) {
    return new DuplicateInventoryReservationError({
      keys: Object.keys(error.keyPattern || {}),
      values: error.keyValue || {}
    });
  }

  return new InventoryDatabaseError(
    error && error.message ? `Inventory database operation failed: ${error.message}` : 'Inventory database operation failed',
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

class InventoryRepository {
  constructor({ bookModel = Book, reservationModel = InventoryReservation } = {}) {
    this.Book = bookModel;
    this.InventoryReservation = reservationModel;
  }

  reserveStock(reservationData, options = {}) {
    return execute(async () => {
      const bookId = normalizeObjectId(reservationData.book, 'book');
      const quantity = Number(reservationData.quantity);
      const book = await this.Book.findOneAndUpdate(
        {
          _id: bookId,
          $expr: {
            $gte: [
              { $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] },
              quantity
            ]
          }
        },
        { $inc: { reservedStock: quantity } },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!book) {
        throw new InsufficientInventoryError({ book: bookId, quantity });
      }

      const documents = await this.InventoryReservation.create([{
        ...reservationData,
        book: bookId,
        quantity,
        status: 'RESERVED'
      }], { session: options.session });

      return documents[0];
    });
  }

  releaseReservation(reservationId, releaseData = {}, options = {}) {
    return execute(async () => {
      normalizeObjectId(reservationId);
      const reservation = await this.InventoryReservation.findOneAndUpdate(
        { _id: reservationId, status: 'RESERVED' },
        {
          $set: {
            status: releaseData.status || 'RELEASED',
            releasedAt: releaseData.releasedAt || options.now || new Date(),
            reason: releaseData.reason
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!reservation) {
        throw new InventoryReservationNotFoundError({ reservationId, status: 'RESERVED' });
      }

      await this.Book.updateOne(
        { _id: reservation.book, reservedStock: { $gte: reservation.quantity } },
        { $inc: { reservedStock: -reservation.quantity } },
        { session: options.session }
      );

      return reservation;
    });
  }

  confirmDeduction(reservationId, deductionData = {}, options = {}) {
    return execute(async () => {
      normalizeObjectId(reservationId);
      const reservation = await this.InventoryReservation.findOneAndUpdate(
        { _id: reservationId, status: 'RESERVED' },
        {
          $set: {
            status: 'DEDUCTED',
            deductedAt: deductionData.deductedAt || options.now || new Date(),
            reason: deductionData.reason
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!reservation) {
        throw new InventoryReservationNotFoundError({ reservationId, status: 'RESERVED' });
      }

      const bookUpdate = await this.Book.updateOne(
        {
          _id: reservation.book,
          stock: { $gte: reservation.quantity },
          reservedStock: { $gte: reservation.quantity }
        },
        {
          $inc: {
            stock: -reservation.quantity,
            reservedStock: -reservation.quantity
          }
        },
        { session: options.session }
      );

      if (bookUpdate.modifiedCount !== 1) {
        throw new InsufficientInventoryError({ book: reservation.book, quantity: reservation.quantity });
      }

      return reservation;
    });
  }

  findReservations(filters = {}, pagination = {}, options = {}) {
    return this.searchReservations({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findByOrder(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.InventoryReservation.find({ order: normalizeObjectId(orderId, 'order') }).sort({ createdAt: 1 }),
      options
    ));
  }

  findByPayment(paymentId, options = {}) {
    return execute(async () => applyReadOptions(
      this.InventoryReservation.find({ payment: normalizeObjectId(paymentId, 'payment') }).sort({ createdAt: 1 }),
      options
    ));
  }

  findActiveByOrder(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.InventoryReservation.find({
        order: normalizeObjectId(orderId, 'order'),
        status: 'RESERVED'
      }).sort({ createdAt: 1 }),
      options
    ));
  }

  findExpiredReservations(cutoffDate = new Date(), pagination = {}, options = {}) {
    return this.searchReservations({
      status: 'RESERVED',
      expiresBefore: cutoffDate,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { expiresAt: 1, createdAt: 1 }
    }, options);
  }

  findLowStock(threshold = 5, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);

    return execute(async () => {
      const query = {
        $expr: {
          $lte: [
            { $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] },
            Number(threshold)
          ]
        }
      };
      const itemsQuery = applyReadOptions(
        this.Book.find(query).sort(options.sort || { stock: 1 }).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Book.countDocuments(query).session(options.session || null);
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

  searchInventory(filters = {}, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);

    return execute(async () => {
      const query = {};
      if (filters.book) query._id = normalizeObjectId(filters.book, 'book');
      if (filters.status) query.status = filters.status;

      const itemsQuery = applyReadOptions(
        this.Book.find(query).sort(options.sort || { title: 1 }).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Book.countDocuments(query).session(options.session || null);
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

  searchReservations(filters = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(filters);

    return execute(async () => {
      const query = this.buildReservationFilter(filters);
      const itemsQuery = applyReadOptions(
        this.InventoryReservation.find(query).sort(filters.sort || { createdAt: -1 }).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.InventoryReservation.countDocuments(query).session(options.session || null);
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

  buildReservationFilter(filters = {}) {
    const query = {};

    if (filters.order) query.order = normalizeObjectId(filters.order, 'order');
    if (filters.payment) query.payment = normalizeObjectId(filters.payment, 'payment');
    if (filters.book) query.book = normalizeObjectId(filters.book, 'book');
    if (filters.status) query.status = filters.status;
    if (filters.statuses && filters.statuses.length) query.status = { $in: filters.statuses };

    if (filters.expiresBefore || filters.expiresAfter) {
      query.expiresAt = {};
      if (filters.expiresBefore) query.expiresAt.$lte = new Date(filters.expiresBefore);
      if (filters.expiresAfter) query.expiresAt.$gte = new Date(filters.expiresAfter);
    }

    return query;
  }
}

module.exports = new InventoryRepository();
module.exports.InventoryRepository = InventoryRepository;
module.exports.InventoryRepositoryError = InventoryRepositoryError;
module.exports.InvalidInventoryIdError = InvalidInventoryIdError;
module.exports.InventoryReservationNotFoundError = InventoryReservationNotFoundError;
module.exports.DuplicateInventoryReservationError = DuplicateInventoryReservationError;
module.exports.InsufficientInventoryError = InsufficientInventoryError;
module.exports.InventoryDatabaseError = InventoryDatabaseError;
