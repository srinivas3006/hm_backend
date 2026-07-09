const { registerInvoiceSubscriber } = require('./invoiceSubscriber');
const { registerNotificationSubscriber } = require('./notificationSubscriber');
const { registerShipmentSubscriber } = require('./shipmentSubscriber');
const { registerAnalyticsSubscriber } = require('./analyticsSubscriber');

const registerSubscribers = () => {
  const subscriptions = [];
  subscriptions.push(...registerAnalyticsSubscriber());
  subscriptions.push(...registerInvoiceSubscriber());
  subscriptions.push(...registerShipmentSubscriber());
  subscriptions.push(...registerNotificationSubscriber());
  return subscriptions;
};

module.exports = {
  registerSubscribers
};
