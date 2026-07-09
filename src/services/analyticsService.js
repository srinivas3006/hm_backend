const analyticsRepository = require('../repositories/analyticsRepository');
const reportGenerator = require('../reports/reportGenerator');

const dayBucket = (date) => new Date(date).toISOString().slice(0, 10);

class AnalyticsService {
  constructor({ repository = analyticsRepository, reporter = reportGenerator } = {}) {
    this.repository = repository;
    this.reporter = reporter;
  }

  async processEvent(event) {
    const projection = this.mapEvent(event);
    if (!projection) return null;
    return this.repository.recordEvent(projection);
  }

  async dashboard(filters = {}) {
    const [revenue, payments, inventory, shipments, customers, bestBooks] = await Promise.all([
      this.repository.getRevenueSummary({ ...filters, period: 'daily' }),
      this.repository.getPaymentMetrics(filters),
      this.repository.getInventoryMetrics(filters),
      this.repository.getShipmentMetrics(filters),
      this.repository.getCustomerMetrics(filters, { limit: 5 }),
      this.repository.getBookSales(filters, { limit: 5 })
    ]);
    return this.reporter.exportReady('dashboard', { revenue, payments, inventory, shipments, customers, bestBooks }, filters);
  }

  async revenue(filters = {}) {
    return this.reporter.exportReady('revenue', await this.repository.getRevenueSummary(filters), filters);
  }

  async books(filters = {}) {
    const [bestSelling, lowestSelling] = await Promise.all([
      this.repository.getBookSales(filters, filters, { sort: 'best' }),
      this.repository.getBookSales(filters, filters, { sort: 'lowest' })
    ]);
    return this.reporter.exportReady('books', { bestSelling, lowestSelling }, filters);
  }

  async payments(filters = {}) {
    return this.reporter.exportReady('payments', await this.repository.getPaymentMetrics(filters), filters);
  }

  async inventory(filters = {}) {
    return this.reporter.exportReady('inventory', await this.repository.getInventoryMetrics(filters), filters);
  }

  async shipments(filters = {}) {
    return this.reporter.exportReady('shipments', await this.repository.getShipmentMetrics(filters), filters);
  }

  async customers(filters = {}) {
    return this.reporter.exportReady('customers', await this.repository.getCustomerMetrics(filters, filters), filters);
  }

  mapEvent(event) {
    const payload = event.payload || {};
    const occurredAt = event.occurredAt || new Date();
    const base = {
      eventId: event.eventId,
      eventType: event.eventName,
      occurredAt,
      bucketDay: dayBucket(occurredAt),
      order: payload.orderId,
      payment: payload.paymentId,
      invoice: payload.invoiceObjectId || payload.invoiceId,
      shipment: payload.shipmentId,
      user: payload.userId || payload.customerId,
      status: payload.status,
      metadata: payload
    };

    switch (event.eventName) {
      case 'OrderCreated':
        return { ...base, amount: Number(payload.totalPrice || 0) };
      case 'PaymentVerified':
        return { ...base, amount: Number(payload.amount || 0) };
      case 'PaymentRejected':
        return { ...base, amount: Number(payload.amount || 0) };
      case 'InvoiceGenerated':
        return { ...base, amount: Number(payload.total || 0) };
      case 'InventoryReserved':
      case 'InventoryReleased':
        return { ...base, quantity: Number(payload.quantity || payload.count || 0), book: payload.bookId };
      case 'InventoryDeducted':
        return { ...base, quantity: Number(payload.quantity || 0), book: payload.bookId, amount: Number(payload.amount || 0) };
      case 'ShipmentCreated':
      case 'ShipmentDelivered':
      case 'NotificationSent':
        return base;
      default:
        return null;
    }
  }
}

module.exports = new AnalyticsService();
module.exports.AnalyticsService = AnalyticsService;
