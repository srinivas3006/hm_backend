const DOMAIN_EVENTS = Object.freeze({
  PAYMENT_INTENT_CREATED: 'PaymentIntentCreated',
  QR_CODE_GENERATED: 'QRCodeGenerated',
  PAYMENT_SUBMITTED: 'PaymentSubmitted',
  PAYMENT_VERIFIED: 'PaymentVerified',
  PAYMENT_REJECTED: 'PaymentRejected',
  PAYMENT_EXPIRED: 'PaymentExpired',
  PAYMENT_CANCELLED: 'PaymentCancelled',
  PAYMENT_FAILED: 'PaymentFailed',
  ORDER_CREATED: 'OrderCreated',
  ORDER_CANCELLED: 'OrderCancelled',
  INVENTORY_RESERVED: 'InventoryReserved',
  INVENTORY_RELEASED: 'InventoryReleased',
  INVENTORY_DEDUCTED: 'InventoryDeducted',
  INVENTORY_EXPIRED: 'InventoryExpired',
  LEDGER_CREATED: 'LedgerCreated',
  ADMIN_APPROVED_PAYMENT: 'AdminApprovedPayment',
  ADMIN_REJECTED_PAYMENT: 'AdminRejectedPayment',
  ADMIN_CANCELLED_PAYMENT: 'AdminCancelledPayment',
  ADMIN_EXPIRED_PAYMENT: 'AdminExpiredPayment',
  ADMIN_RECREATED_QR: 'AdminRecreatedQR',
  INVOICE_GENERATED: 'InvoiceGenerated',
  SHIPMENT_CREATED: 'ShipmentCreated',
  COURIER_ASSIGNED: 'CourierAssigned',
  SHIPMENT_DISPATCHED: 'ShipmentDispatched',
  SHIPMENT_DELIVERED: 'ShipmentDelivered',
  SHIPMENT_CANCELLED: 'ShipmentCancelled'
});

const EVENT_CATALOG = Object.freeze({
  [DOMAIN_EVENTS.PAYMENT_INTENT_CREATED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A payment intent was created for an order.'
  },
  [DOMAIN_EVENTS.QR_CODE_GENERATED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A dynamic QR was generated or regenerated for an active payment intent.'
  },
  [DOMAIN_EVENTS.PAYMENT_SUBMITTED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A customer submitted a manual payment reference.'
  },
  [DOMAIN_EVENTS.PAYMENT_VERIFIED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'An authorized actor verified a payment.'
  },
  [DOMAIN_EVENTS.PAYMENT_REJECTED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'An authorized actor rejected a payment.'
  },
  [DOMAIN_EVENTS.PAYMENT_EXPIRED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A payment intent expired.'
  },
  [DOMAIN_EVENTS.PAYMENT_CANCELLED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A payment intent was cancelled.'
  },
  [DOMAIN_EVENTS.PAYMENT_FAILED]: {
    producer: 'PaymentService',
    entity: 'Payment',
    description: 'A payment attempt failed.'
  },
  [DOMAIN_EVENTS.ORDER_CREATED]: {
    producer: 'OrderPaymentBridgeService',
    entity: 'Order',
    description: 'An order was created with payment and inventory orchestration.'
  },
  [DOMAIN_EVENTS.ORDER_CANCELLED]: {
    producer: 'OrderPaymentBridgeService',
    entity: 'Order',
    description: 'An order cancellation released runtime resources.'
  },
  [DOMAIN_EVENTS.INVENTORY_RESERVED]: {
    producer: 'InventoryService',
    entity: 'InventoryReservation',
    description: 'Inventory was reserved for checkout.'
  },
  [DOMAIN_EVENTS.INVENTORY_RELEASED]: {
    producer: 'InventoryService',
    entity: 'InventoryReservation',
    description: 'A reservation was released.'
  },
  [DOMAIN_EVENTS.INVENTORY_DEDUCTED]: {
    producer: 'InventoryService',
    entity: 'InventoryReservation',
    description: 'Reserved inventory was converted to stock deduction.'
  },
  [DOMAIN_EVENTS.INVENTORY_EXPIRED]: {
    producer: 'InventoryService',
    entity: 'InventoryReservation',
    description: 'A reservation expired.'
  },
  [DOMAIN_EVENTS.LEDGER_CREATED]: {
    producer: 'PaymentService|InventoryService',
    entity: 'Ledger',
    description: 'An immutable ledger entry was written.'
  },
  [DOMAIN_EVENTS.ADMIN_APPROVED_PAYMENT]: {
    producer: 'AdminOperationsService',
    entity: 'Payment',
    description: 'An admin approved a payment through operations tooling.'
  },
  [DOMAIN_EVENTS.ADMIN_REJECTED_PAYMENT]: {
    producer: 'AdminOperationsService',
    entity: 'Payment',
    description: 'An admin rejected a payment through operations tooling.'
  },
  [DOMAIN_EVENTS.ADMIN_CANCELLED_PAYMENT]: {
    producer: 'AdminOperationsService',
    entity: 'Payment',
    description: 'An admin cancelled a payment intent.'
  },
  [DOMAIN_EVENTS.ADMIN_EXPIRED_PAYMENT]: {
    producer: 'AdminOperationsService',
    entity: 'Payment',
    description: 'An admin expired a payment intent.'
  },
  [DOMAIN_EVENTS.ADMIN_RECREATED_QR]: {
    producer: 'AdminOperationsService',
    entity: 'Payment',
    description: 'An admin regenerated a payment QR.'
  },
  [DOMAIN_EVENTS.INVOICE_GENERATED]: {
    producer: 'InvoiceService',
    entity: 'Invoice',
    description: 'An official invoice was generated for a verified payment.'
  },
  [DOMAIN_EVENTS.SHIPMENT_CREATED]: {
    producer: 'ShipmentService',
    entity: 'Shipment',
    description: 'A shipment was created for a paid and invoiced order.'
  },
  [DOMAIN_EVENTS.COURIER_ASSIGNED]: {
    producer: 'ShipmentService',
    entity: 'Shipment',
    description: 'A courier was assigned to a shipment.'
  },
  [DOMAIN_EVENTS.SHIPMENT_DISPATCHED]: {
    producer: 'ShipmentService',
    entity: 'Shipment',
    description: 'A shipment entered dispatch or transit.'
  },
  [DOMAIN_EVENTS.SHIPMENT_DELIVERED]: {
    producer: 'ShipmentService',
    entity: 'Shipment',
    description: 'A shipment was delivered.'
  },
  [DOMAIN_EVENTS.SHIPMENT_CANCELLED]: {
    producer: 'ShipmentService',
    entity: 'Shipment',
    description: 'A shipment was cancelled before dispatch completion.'
  }
});

module.exports = {
  DOMAIN_EVENTS,
  EVENT_CATALOG
};
