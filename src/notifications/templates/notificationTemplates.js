const { DOMAIN_EVENTS } = require('../../events/eventCatalog');

const interpolate = (template, context = {}) => template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
  const value = key.trim().split('.').reduce((current, part) => (current ? current[part] : undefined), context);
  return value === undefined || value === null ? '' : String(value);
});

const TEMPLATES = {
  [DOMAIN_EVENTS.PAYMENT_VERIFIED]: {
    subject: 'Payment verified',
    body: '<p>Hello {{user.name}},</p><p>Your payment for order {{order.orderNumber}} has been verified.</p>'
  },
  [DOMAIN_EVENTS.INVOICE_GENERATED]: {
    subject: 'Invoice {{invoice.invoiceNumber}} generated',
    body: '<p>Hello {{user.name}},</p><p>Your invoice {{invoice.invoiceNumber}} for order {{order.orderNumber}} is ready.</p>'
  },
  [DOMAIN_EVENTS.ORDER_CANCELLED]: {
    subject: 'Order {{order.orderNumber}} cancelled',
    body: '<p>Hello {{user.name}},</p><p>Your order {{order.orderNumber}} has been cancelled.</p>'
  },
  [DOMAIN_EVENTS.INVENTORY_RELEASED]: {
    subject: 'Inventory reservation released',
    body: '<p>Hello {{user.name}},</p><p>The reserved inventory for order {{order.orderNumber}} has been released.</p>'
  },
  [DOMAIN_EVENTS.PAYMENT_REJECTED]: {
    subject: 'Payment rejected',
    body: '<p>Hello {{user.name}},</p><p>Your payment for order {{order.orderNumber}} was rejected. Please create a new payment attempt.</p>'
  },
  [DOMAIN_EVENTS.SHIPMENT_CREATED]: {
    subject: 'Shipment created for order {{order.orderNumber}}',
    body: '<p>Hello {{user.name}},</p><p>Your shipment for order {{order.orderNumber}} has been created.</p>'
  },
  [DOMAIN_EVENTS.COURIER_ASSIGNED]: {
    subject: 'Courier assigned for order {{order.orderNumber}}',
    body: '<p>Hello {{user.name}},</p><p>Your shipment is assigned to {{shipment.courier.provider}}. Tracking number: {{shipment.trackingNumber}}</p>'
  },
  [DOMAIN_EVENTS.SHIPMENT_DISPATCHED]: {
    subject: 'Shipment dispatched',
    body: '<p>Hello {{user.name}},</p><p>Your shipment for order {{order.orderNumber}} is now {{shipment.status}}.</p>'
  },
  [DOMAIN_EVENTS.SHIPMENT_DELIVERED]: {
    subject: 'Shipment delivered',
    body: '<p>Hello {{user.name}},</p><p>Your order {{order.orderNumber}} has been delivered.</p>'
  },
  [DOMAIN_EVENTS.SHIPMENT_CANCELLED]: {
    subject: 'Shipment cancelled',
    body: '<p>Hello {{user.name}},</p><p>The shipment for order {{order.orderNumber}} has been cancelled.</p>'
  }
};

class NotificationTemplateRenderer {
  render(eventType, context = {}) {
    const template = TEMPLATES[eventType] || {
      subject: eventType,
      body: '<p>Hello {{user.name}},</p><p>There is an update on your account.</p>'
    };

    return {
      templateKey: eventType,
      subject: interpolate(template.subject, context),
      body: interpolate(template.body, context)
    };
  }
}

module.exports = new NotificationTemplateRenderer();
module.exports.NotificationTemplateRenderer = NotificationTemplateRenderer;
module.exports.TEMPLATES = TEMPLATES;
