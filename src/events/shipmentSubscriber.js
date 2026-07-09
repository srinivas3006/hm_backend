const eventBus = require('./eventBus');
const { DOMAIN_EVENTS } = require('./eventCatalog');
const shipmentService = require('../services/shipmentService');
const invoiceRepository = require('../repositories/invoiceRepository');
const logger = require('../utils/logger');

let registered = false;

const registerShipmentSubscriber = ({
  bus = eventBus,
  service = shipmentService,
  invoices = invoiceRepository,
  serviceLogger = logger
} = {}) => {
  if (registered) return [];

  const subscriptions = [];

  subscriptions.push(bus.subscribe(DOMAIN_EVENTS.INVOICE_GENERATED, async (event) => {
    const shipment = await service.createFromInvoiceGeneratedEvent(event);
    serviceLogger.info('shipment.subscriber_created', {
      eventId: event.eventId,
      shipmentId: shipment.shipmentId,
      orderId: event.payload.orderId
    });
  }, { id: 'shipment:InvoiceGenerated' }));

  subscriptions.push(bus.subscribe(DOMAIN_EVENTS.PAYMENT_VERIFIED, async (event) => {
    const invoice = await invoices.findByPayment(event.payload.paymentId);
    if (invoice) {
      await service.createShipmentForInvoice(invoice._id, {
        correlationId: event.correlationId,
        metadata: {
          sourceEventId: event.eventId,
          sourceEventName: event.eventName
        }
      });
    }
  }, { id: 'shipment:PaymentVerified' }));

  subscriptions.push(bus.subscribe(DOMAIN_EVENTS.ORDER_CANCELLED, async (event) => {
    await service.cancelByOrder(event.payload.orderId, {
      userId: event.payload.userId
    }, {
      correlationId: event.correlationId,
      actorType: 'SYSTEM',
      reason: 'Shipment cancelled after order cancellation'
    });
  }, { id: 'shipment:OrderCancelled' }));

  subscriptions.push(bus.subscribe(DOMAIN_EVENTS.INVENTORY_RELEASED, async (event) => {
    if (event.payload.orderId) {
      await service.cancelByOrder(event.payload.orderId, {
        userId: event.payload.actorId
      }, {
        correlationId: event.correlationId,
        actorType: 'SYSTEM',
        reason: 'Shipment cancelled after inventory release'
      });
    }
  }, { id: 'shipment:InventoryReleased' }));

  registered = true;
  return subscriptions;
};

const resetShipmentSubscriberRegistration = () => {
  registered = false;
};

module.exports = {
  registerShipmentSubscriber,
  resetShipmentSubscriberRegistration
};
