const crypto = require('crypto');
const mongoose = require('mongoose');

const SHIPMENT_LEDGER_EVENTS = [
  'SHIPMENT_CREATED',
  'COURIER_ASSIGNED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED'
];

const shipmentLedgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
      immutable: true
    },
    eventKey: {
      type: String,
      trim: true,
      immutable: true
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true,
      index: true,
      immutable: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      immutable: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
      immutable: true
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
      immutable: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      immutable: true
    },
    eventType: {
      type: String,
      enum: SHIPMENT_LEDGER_EVENTS,
      required: true,
      immutable: true
    },
    previousStatus: {
      type: String,
      trim: true,
      immutable: true
    },
    currentStatus: {
      type: String,
      trim: true,
      required: true,
      immutable: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true
    },
    actorType: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'SYSTEM', 'JOB', 'COURIER', 'UNKNOWN'],
      default: 'UNKNOWN',
      immutable: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      immutable: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true
    }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false
    }
  }
);

shipmentLedgerSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: 'string' } }
  }
);
shipmentLedgerSchema.index({ shipment: 1, createdAt: 1 });
shipmentLedgerSchema.index({ order: 1, createdAt: 1 });
shipmentLedgerSchema.index({ eventType: 1, createdAt: -1 });
shipmentLedgerSchema.index({ createdAt: -1 });

const preventMutation = function () {
  throw new Error('Shipment ledger is append-only');
};

shipmentLedgerSchema.pre('save', function () {
  if (!this.isNew) throw new Error('Shipment ledger is append-only');
});

[
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndRemove',
  'remove'
].forEach((operation) => shipmentLedgerSchema.pre(operation, preventMutation));

module.exports = mongoose.model('ShipmentLedger', shipmentLedgerSchema);
module.exports.SHIPMENT_LEDGER_EVENTS = SHIPMENT_LEDGER_EVENTS;
