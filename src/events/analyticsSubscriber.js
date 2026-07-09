const eventBus = require('./eventBus');
const { DOMAIN_EVENTS } = require('./eventCatalog');
const analyticsService = require('../services/analyticsService');

const ANALYTICS_EVENTS = [
  DOMAIN_EVENTS.ORDER_CREATED,
  DOMAIN_EVENTS.PAYMENT_VERIFIED,
  DOMAIN_EVENTS.PAYMENT_REJECTED,
  DOMAIN_EVENTS.INVOICE_GENERATED,
  DOMAIN_EVENTS.INVENTORY_RESERVED,
  DOMAIN_EVENTS.INVENTORY_RELEASED,
  DOMAIN_EVENTS.INVENTORY_DEDUCTED,
  DOMAIN_EVENTS.SHIPMENT_CREATED,
  DOMAIN_EVENTS.SHIPMENT_DELIVERED
];

let registered = false;

const registerAnalyticsSubscriber = ({ bus = eventBus, service = analyticsService } = {}) => {
  if (registered) return [];
  const subscriptions = ANALYTICS_EVENTS.map((eventName) => bus.subscribe(eventName, async (event) => {
    await service.processEvent(event);
  }, { id: `analytics:${eventName}` }));
  registered = true;
  return subscriptions;
};

const resetAnalyticsSubscriberRegistration = () => {
  registered = false;
};

module.exports = {
  ANALYTICS_EVENTS,
  registerAnalyticsSubscriber,
  resetAnalyticsSubscriberRegistration
};
