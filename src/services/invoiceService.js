const mongoose = require('mongoose');
const invoiceRepository = require('../repositories/invoiceRepository');
const paymentRepository = require('../repositories/paymentRepository');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const invoicePdfGenerator = require('../invoices/pdf/invoicePdfGenerator');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');

class InvoiceServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvoiceGenerationNotAllowedError extends InvoiceServiceError {
  constructor(message = 'Invoice can only be generated after successful payment verification', details = {}) {
    super(message, 'INVOICE_GENERATION_NOT_ALLOWED', details);
  }
}

class InvoiceDuplicateError extends InvoiceServiceError {
  constructor(details = {}) {
    super('Invoice already exists for this payment or order', 'INVOICE_DUPLICATE', details);
  }
}

class InvoiceDataAccessError extends InvoiceServiceError {
  constructor(message = 'Invoice data access failed', details = {}) {
    super(message, 'INVOICE_DATA_ACCESS_ERROR', details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

class InvoiceService {
  constructor({
    repository = invoiceRepository,
    payments = paymentRepository,
    orderModel = Order,
    pdfGenerator = invoicePdfGenerator,
    serviceLogger = logger
  } = {}) {
    this.repository = repository;
    this.paymentRepository = payments;
    this.Order = orderModel;
    this.pdfGenerator = pdfGenerator;
    this.logger = serviceLogger;
  }

  async generateForPayment(paymentId, options = {}) {
    return this.execute('generateForPayment', async () => {
      const existing = await this.repository.findByPayment(paymentId, { session: options.session });
      if (existing) return existing;

      const payment = await this.paymentRepository.getById(paymentId, {
        session: options.session,
        lean: true
      });
      this.assertPaymentVerified(payment);

      const existingByOrder = await this.repository.findByOrder(payment.order, { session: options.session });
      if (existingByOrder) return existingByOrder;

      const order = await this.Order.findById(payment.order)
        .populate('user', 'name email')
        .populate('items.book', 'title slug isbn')
        .session(options.session || null)
        .lean();

      if (!order) {
        throw new InvoiceGenerationNotAllowedError('Order not found for invoice generation', {
          orderId: normalizeId(payment.order)
        });
      }

      const invoiceNumber = await this.generateInvoiceNumber(options);
      const now = options.now || new Date();
      const invoiceDraft = this.buildInvoiceDraft({ payment, order, invoiceNumber, generatedAt: now, metadata: options.metadata });
      const document = await this.pdfGenerator.generate(invoiceDraft, options.document || {});
      let invoice;
      try {
        invoice = await this.repository.createInvoice({
          ...invoiceDraft,
          document: {
            contentType: document.contentType,
            fileName: document.fileName,
            data: document.buffer,
            generatedAt: now,
            template: document.template,
            checksum: document.checksum
          }
        }, { session: options.session });
      } catch (error) {
        if (error && error.code === 'DUPLICATE_INVOICE') {
          const duplicate = await this.repository.findByPayment(paymentId, { session: options.session }) ||
            await this.repository.findByOrder(payment.order, { session: options.session });
          if (duplicate) return duplicate;
        }
        throw error;
      }

      this.logger.info('invoice.generated', {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        paymentId: normalizeId(payment._id),
        orderId: normalizeId(order._id)
      });

      await eventBus.publish(DOMAIN_EVENTS.INVOICE_GENERATED, {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceObjectId: normalizeId(invoice._id),
        orderId: normalizeId(invoice.order),
        paymentId: normalizeId(invoice.payment),
        customerId: normalizeId(invoice.customer),
        total: invoice.total,
        currency: invoice.currency
      }, {
        session: options.session,
        correlationId: options.correlationId,
        idempotencyKey: `${DOMAIN_EVENTS.INVOICE_GENERATED}:${normalizeId(invoice.payment)}`
      });

      return invoice;
    });
  }

  async generateFromPaymentVerifiedEvent(event) {
    return this.generateForPayment(event.payload.paymentId, {
      correlationId: event.correlationId,
      metadata: {
        sourceEventId: event.eventId,
        sourceEventName: event.eventName
      }
    });
  }

  async regenerateDocument(invoiceId, options = {}) {
    return this.execute('regenerateDocument', async () => {
      const invoice = await this.repository.getById(invoiceId, {
        session: options.session,
        includeDocument: true,
        lean: false
      });
      const document = await this.pdfGenerator.generate(invoice.toObject(), options.document || {});
      invoice.document = {
        contentType: document.contentType,
        fileName: document.fileName,
        data: document.buffer,
        generatedAt: options.now || new Date(),
        template: document.template,
        checksum: document.checksum
      };
      invoice.regenerationHistory.push({
        reason: options.reason || 'Invoice document regenerated',
        metadata: options.metadata || {}
      });
      await invoice.save({ session: options.session });
      return invoice;
    });
  }

  async getInvoice(id, options = {}) {
    return this.execute('getInvoice', () => this.repository.getById(id, options));
  }

  async getInvoiceDocument(id, options = {}) {
    return this.execute('getInvoiceDocument', async () => {
      const invoice = await this.repository.getById(id, {
        ...options,
        includeDocument: true
      });
      return {
        invoice,
        buffer: this.toBuffer(invoice.document && invoice.document.data),
        contentType: invoice.document && invoice.document.contentType,
        fileName: invoice.document && invoice.document.fileName
      };
    });
  }

  async listInvoices(filters = {}, pagination = {}, options = {}) {
    return this.execute('listInvoices', () => this.repository.listInvoices(filters, pagination, options));
  }

  async searchInvoices(filters = {}, pagination = {}, options = {}) {
    return this.execute('searchInvoices', () => this.repository.searchInvoices(filters, pagination, options));
  }

  async generateInvoiceNumber(options = {}) {
    const now = options.now || new Date();
    const key = `invoice:${now.getUTCFullYear()}:${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const counter = await this.repository.nextSequence(key, { session: options.session });
    return `INV-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(counter.sequence).padStart(6, '0')}`;
  }

  buildInvoiceDraft({ payment, order, invoiceNumber, generatedAt, metadata = {} }) {
    const itemSubtotal = order.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const taxTotal = Number(order.tax || 0);
    const taxRatio = itemSubtotal > 0 ? taxTotal / itemSubtotal : 0;

    return {
      invoiceNumber,
      order: order._id,
      payment: payment._id,
      customer: order.user && order.user._id ? order.user._id : order.user,
      customerName: order.user && order.user.name,
      orderNumber: order.orderNumber,
      items: order.items.map((item) => {
        const lineBase = Number(item.price || 0) * Number(item.quantity || 0);
        const taxAmount = Number((lineBase * taxRatio).toFixed(2));
        return {
          book: item.book && item.book._id ? item.book._id : item.book,
          title: item.book && item.book.title ? item.book.title : 'Book',
          quantity: item.quantity,
          unitPrice: item.price,
          taxAmount,
          discountAmount: 0,
          lineTotal: Number((lineBase + taxAmount).toFixed(2))
        };
      }),
      subtotal: Number(order.subtotal || itemSubtotal || 0),
      taxTotal,
      discountTotal: 0,
      shippingTotal: Number(order.shippingPrice || 0),
      total: Number(order.totalPrice || payment.amount || 0),
      currency: payment.currency || 'INR',
      status: 'GENERATED',
      generatedAt,
      taxMetadata: {
        strategy: 'order-tax-snapshot',
        gstReady: true
      },
      metadata: {
        ...metadata,
        paymentStatus: payment.status,
        paymentProvider: payment.provider,
        paymentMethod: payment.paymentMethod
      }
    };
  }

  assertPaymentVerified(payment) {
    if (!payment || payment.status !== 'PAYMENT_VERIFIED' || !payment.successfulPayment) {
      throw new InvoiceGenerationNotAllowedError('Payment must be verified before invoice generation', {
        paymentId: payment && normalizeId(payment._id),
        status: payment && payment.status
      });
    }
  }

  toBuffer(value) {
    if (!value) return Buffer.alloc(0);
    if (Buffer.isBuffer(value)) return value;
    if (value.buffer) return Buffer.from(value.buffer);
    if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    return Buffer.from(value);
  }

  async withTransaction(handler) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const result = await handler(session);
      await session.commitTransaction();
      await eventBus.flushSession(session);
      return result;
    } catch (error) {
      await session.abortTransaction();
      eventBus.discardSession(session);
      throw error;
    } finally {
      session.endSession();
    }
  }

  mapRepositoryError(error, operation) {
    if (error instanceof InvoiceServiceError) return error;
    if (error && error.code === 'DUPLICATE_INVOICE') {
      return new InvoiceDuplicateError({ operation, ...error.details });
    }
    if (error && error.code && error.code.startsWith('INVOICE_')) {
      return new InvoiceDataAccessError(error.message, { operation, repositoryCode: error.code });
    }
    return error;
  }

  async execute(operation, handler) {
    try {
      return await handler();
    } catch (error) {
      const mappedError = this.mapRepositoryError(error, operation);
      if (mappedError instanceof InvoiceServiceError) {
        this.logger.warn('invoice.service_error', {
          operation,
          code: mappedError.code
        });
      }
      throw mappedError;
    }
  }
}

module.exports = new InvoiceService();
module.exports.InvoiceService = InvoiceService;
module.exports.InvoiceServiceError = InvoiceServiceError;
module.exports.InvoiceGenerationNotAllowedError = InvoiceGenerationNotAllowedError;
module.exports.InvoiceDuplicateError = InvoiceDuplicateError;
module.exports.InvoiceDataAccessError = InvoiceDataAccessError;
