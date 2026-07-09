const inventoryRepository = require('../repositories/inventoryRepository');
const inventoryLedgerRepository = require('../repositories/inventoryLedgerRepository');
const logger = require('../utils/logger');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');

const DEFAULT_RESERVATION_MINUTES = 20;

class InventoryServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InventoryReservationError extends InventoryServiceError {
  constructor(message = 'Inventory reservation failed', details = {}) {
    super(message, 'INVENTORY_RESERVATION_ERROR', details);
  }
}

class InventoryReleaseError extends InventoryServiceError {
  constructor(message = 'Inventory release failed', details = {}) {
    super(message, 'INVENTORY_RELEASE_ERROR', details);
  }
}

class InventoryDeductionError extends InventoryServiceError {
  constructor(message = 'Inventory deduction failed', details = {}) {
    super(message, 'INVENTORY_DEDUCTION_ERROR', details);
  }
}

class InventoryValidationError extends InventoryServiceError {
  constructor(message = 'Inventory validation failed', details = {}) {
    super(message, 'INVENTORY_VALIDATION_ERROR', details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

class InventoryService {
  constructor({
    repository = inventoryRepository,
    ledgerRepository = inventoryLedgerRepository,
    serviceLogger = logger
  } = {}) {
    this.repository = repository;
    this.ledgerRepository = ledgerRepository;
    this.logger = serviceLogger;
  }

  async reserveOrderItems({ order, payment, items }, options = {}) {
    return this.execute('reserveOrderItems', async () => {
      if (!order || !payment || !items || !items.length) {
        throw new InventoryValidationError('Order, payment, and items are required for reservation');
      }

      const now = options.now || new Date();
      const expiresAt = options.expiresAt || (payment.expiresAt ? new Date(payment.expiresAt) : addMinutes(now, options.reservationMinutes || DEFAULT_RESERVATION_MINUTES));
      const reservations = [];

      for (const item of items) {
        const reservation = await this.repository.reserveStock({
          order: order._id,
          payment: payment._id,
          book: item.book,
          quantity: item.quantity,
          reservedAt: now,
          expiresAt,
          reason: options.reason || 'Inventory reserved for checkout'
        }, { session: options.session });

        await this.recordLedgerEvent(reservation, 'RESERVED', {
          previousStatus: null,
          currentStatus: 'RESERVED',
          actor: options.actor,
          actorType: options.actorType || 'CUSTOMER',
          reason: options.reason || 'Inventory reserved for checkout',
          session: options.session
        });

        reservations.push(reservation);
      }

      this.logInfo('inventory.reserved', {
        order: normalizeId(order._id),
        payment: normalizeId(payment._id),
        count: reservations.length
      });

      await eventBus.publish(DOMAIN_EVENTS.INVENTORY_RESERVED, {
        orderId: normalizeId(order._id),
        paymentId: normalizeId(payment._id),
        reservationIds: reservations.map((reservation) => normalizeId(reservation._id)),
        count: reservations.length
      }, {
        session: options.session,
        correlationId: options.correlationId,
        idempotencyKey: `${DOMAIN_EVENTS.INVENTORY_RESERVED}:${normalizeId(order._id)}:${normalizeId(payment._id)}`
      });

      return reservations;
    });
  }

  async releaseByOrder(orderId, options = {}) {
    return this.execute('releaseByOrder', async () => {
      const reservations = await this.repository.findActiveByOrder(orderId, { session: options.session, lean: true });
      const released = [];

      for (const reservation of reservations) {
        released.push(await this.releaseReservation(reservation._id, options));
      }

      return released;
    });
  }

  async releaseByPayment(paymentId, options = {}) {
    return this.execute('releaseByPayment', async () => {
      const reservations = await this.repository.findByPayment(paymentId, { session: options.session, lean: true });
      const released = [];

      for (const reservation of reservations.filter((item) => item.status === 'RESERVED')) {
        released.push(await this.releaseReservation(reservation._id, options));
      }

      return released;
    });
  }

  async releaseReservation(reservationId, options = {}) {
    return this.execute('releaseReservation', async () => {
      const released = await this.repository.releaseReservation(reservationId, {
        status: options.status || 'RELEASED',
        reason: options.reason || 'Inventory reservation released',
        releasedAt: options.now || new Date()
      }, { session: options.session });

      await this.recordLedgerEvent(released, options.ledgerEvent || 'RELEASED', {
        previousStatus: 'RESERVED',
        currentStatus: released.status,
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Inventory reservation released',
        session: options.session
      });

      this.logInfo('inventory.released', {
        reservation: normalizeId(released._id),
        order: normalizeId(released.order),
        book: normalizeId(released.book)
      });

      await eventBus.publish(
        released.status === 'EXPIRED' ? DOMAIN_EVENTS.INVENTORY_EXPIRED : DOMAIN_EVENTS.INVENTORY_RELEASED,
        this.toReservationEventPayload(released, options),
        {
          session: options.session,
          correlationId: options.correlationId,
          idempotencyKey: `${released.status}:${normalizeId(released._id)}`
        }
      );

      return released;
    });
  }

  async deductByPayment(paymentId, options = {}) {
    return this.execute('deductByPayment', async () => {
      const reservations = await this.repository.findByPayment(paymentId, { session: options.session, lean: true });
      const deducted = [];

      for (const reservation of reservations.filter((item) => item.status === 'RESERVED')) {
        deducted.push(await this.confirmDeduction(reservation._id, options));
      }

      return deducted;
    });
  }

  async confirmDeduction(reservationId, options = {}) {
    return this.execute('confirmDeduction', async () => {
      const deducted = await this.repository.confirmDeduction(reservationId, {
        reason: options.reason || 'Inventory deducted after payment verification',
        deductedAt: options.now || new Date()
      }, { session: options.session });

      await this.recordLedgerEvent(deducted, 'DEDUCTED', {
        previousStatus: 'RESERVED',
        currentStatus: 'DEDUCTED',
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Inventory deducted after payment verification',
        session: options.session
      });

      this.logInfo('inventory.deducted', {
        reservation: normalizeId(deducted._id),
        order: normalizeId(deducted.order),
        book: normalizeId(deducted.book)
      });

      await eventBus.publish(DOMAIN_EVENTS.INVENTORY_DEDUCTED, this.toReservationEventPayload(deducted, options), {
        session: options.session,
        correlationId: options.correlationId,
        idempotencyKey: `${DOMAIN_EVENTS.INVENTORY_DEDUCTED}:${normalizeId(deducted._id)}`
      });

      return deducted;
    });
  }

  async expireReservations(cutoffDate = new Date(), options = {}) {
    return this.execute('expireReservations', async () => {
      const result = await this.repository.findExpiredReservations(cutoffDate, {}, {
        session: options.session,
        lean: true
      });
      const expired = [];

      for (const reservation of result.items) {
        expired.push(await this.releaseReservation(reservation._id, {
          ...options,
          status: 'EXPIRED',
          ledgerEvent: 'EXPIRED',
          reason: options.reason || 'Inventory reservation expired'
        }));
      }

      return expired;
    });
  }

  async findReservations(filters = {}, pagination = {}, options = {}) {
    return this.execute('findReservations', () => this.repository.findReservations(filters, pagination, options));
  }

  async findLowStock(threshold = 5, pagination = {}, options = {}) {
    return this.execute('findLowStock', () => this.repository.findLowStock(threshold, pagination, options));
  }

  async searchInventory(filters = {}, pagination = {}, options = {}) {
    return this.execute('searchInventory', () => this.repository.searchInventory(filters, pagination, options));
  }

  async recordLedgerEvent(reservation, eventType, options = {}) {
    const ledger = await this.ledgerRepository.createEntry({
      eventKey: this.buildLedgerEventKey(reservation, eventType),
      reservation: reservation._id,
      order: reservation.order,
      payment: reservation.payment,
      book: reservation.book,
      eventType,
      previousStatus: options.previousStatus,
      currentStatus: options.currentStatus || reservation.status,
      quantity: reservation.quantity,
      actor: options.actor && (options.actor.userId || options.actor._id),
      actorType: options.actorType || 'UNKNOWN',
      reason: options.reason,
      metadata: options.metadata || {}
    }, { session: options.session });

    this.logInfo('inventory_ledger.entry_created', {
      ledgerId: ledger.ledgerId,
      reservation: normalizeId(reservation._id),
      eventType
    });

    await eventBus.publish(DOMAIN_EVENTS.LEDGER_CREATED, {
      ledgerId: ledger.ledgerId,
      ledgerType: 'inventory',
      reservationId: normalizeId(reservation._id),
      orderId: normalizeId(reservation.order),
      paymentId: normalizeId(reservation.payment),
      bookId: normalizeId(reservation.book),
      eventType,
      currentStatus: options.currentStatus || reservation.status,
      previousStatus: options.previousStatus
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `InventoryLedger:${ledger.ledgerId}`
    });

    return ledger;
  }

  toReservationEventPayload(reservation, options = {}) {
    return {
      reservationId: normalizeId(reservation._id),
      orderId: normalizeId(reservation.order),
      paymentId: normalizeId(reservation.payment),
      bookId: normalizeId(reservation.book),
      quantity: reservation.quantity,
      status: reservation.status,
      actorId: options.actor && options.actor.userId ? normalizeId(options.actor.userId) : undefined,
      actorType: options.actorType,
      reason: options.reason
    };
  }

  buildLedgerEventKey(reservation, eventType) {
    return `${normalizeId(reservation._id)}:${eventType}`;
  }

  mapRepositoryError(error, operation) {
    if (error instanceof InventoryServiceError) {
      return error;
    }

    if (error && error.code === 'INSUFFICIENT_INVENTORY') {
      return new InventoryReservationError('Insufficient inventory available', {
        operation,
        repositoryCode: error.code,
        ...error.details
      });
    }

    if (error && error.code === 'DUPLICATE_INVENTORY_RESERVATION') {
      return new InventoryReservationError('Inventory is already reserved for this order/payment item', {
        operation,
        repositoryCode: error.code,
        ...error.details
      });
    }

    if (error && error.code === 'INVENTORY_RESERVATION_NOT_FOUND') {
      if (operation.includes('Deduction') || operation.includes('deduct')) {
        return new InventoryDeductionError('Inventory reservation is not available for deduction', { operation, repositoryCode: error.code });
      }
      return new InventoryReleaseError('Inventory reservation is not available for release', { operation, repositoryCode: error.code });
    }

    if (error && (error.code === 'INVENTORY_DATABASE_ERROR' || error.code === 'INVENTORY_LEDGER_DATABASE_ERROR')) {
      return new InventoryServiceError('Inventory data access failed', 'INVENTORY_DATA_ACCESS_ERROR', {
        operation,
        repositoryCode: error.code
      });
    }

    return error;
  }

  async execute(operation, handler) {
    try {
      return await handler();
    } catch (error) {
      const mappedError = this.mapRepositoryError(error, operation);
      if (mappedError instanceof InventoryServiceError) {
        this.logWarn('inventory.service_error', {
          operation,
          code: mappedError.code
        });
      }
      throw mappedError;
    }
  }

  logInfo(event, metadata = {}) {
    this.logger.info(event, metadata);
  }

  logWarn(event, metadata = {}) {
    this.logger.warn(event, metadata);
  }
}

module.exports = new InventoryService();
module.exports.InventoryService = InventoryService;
module.exports.InventoryServiceError = InventoryServiceError;
module.exports.InventoryReservationError = InventoryReservationError;
module.exports.InventoryReleaseError = InventoryReleaseError;
module.exports.InventoryDeductionError = InventoryDeductionError;
module.exports.InventoryValidationError = InventoryValidationError;
