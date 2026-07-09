const crypto = require('crypto');
const mongoose = require('mongoose');

const INVENTORY_LEDGER_EVENTS = [
  'RESERVED',
  'RELEASED',
  'DEDUCTED',
  'RESTORED',
  'ADJUSTED',
  'EXPIRED'
];

const ACTOR_TYPES = ['CUSTOMER', 'ADMIN', 'SYSTEM', 'JOB', 'UNKNOWN'];

const inventoryLedgerSchema = new mongoose.Schema(
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
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryReservation',
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
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
      immutable: true
    },
    eventType: {
      type: String,
      enum: INVENTORY_LEDGER_EVENTS,
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
    quantity: {
      type: Number,
      required: true,
      min: 0,
      immutable: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true
    },
    actorType: {
      type: String,
      enum: ACTOR_TYPES,
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

inventoryLedgerSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: 'string' } }
  }
);
inventoryLedgerSchema.index({ reservation: 1, createdAt: 1 });
inventoryLedgerSchema.index({ order: 1, createdAt: 1 });
inventoryLedgerSchema.index({ payment: 1, createdAt: 1 });
inventoryLedgerSchema.index({ book: 1, createdAt: -1 });
inventoryLedgerSchema.index({ eventType: 1, createdAt: -1 });
inventoryLedgerSchema.index({ createdAt: -1 });

const preventMutation = function () {
  throw new Error('Inventory ledger is append-only');
};

inventoryLedgerSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Inventory ledger is append-only');
  }
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
].forEach((operation) => {
  inventoryLedgerSchema.pre(operation, preventMutation);
});

const InventoryLedger = mongoose.model('InventoryLedger', inventoryLedgerSchema);

module.exports = InventoryLedger;
module.exports.INVENTORY_LEDGER_EVENTS = INVENTORY_LEDGER_EVENTS;
