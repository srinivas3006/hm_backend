const crypto = require('crypto');
const mongoose = require('mongoose');

const PAYMENT_LEDGER_EVENTS = [
  'INTENT_CREATED',
  'QR_GENERATED',
  'PAYMENT_SUBMITTED',
  'VERIFICATION_PENDING',
  'PAYMENT_VERIFIED',
  'PAYMENT_REJECTED',
  'PAYMENT_FAILED',
  'PAYMENT_EXPIRED',
  'PAYMENT_CANCELLED',
  'REFUND_REQUESTED',
  'REFUND_APPROVED',
  'REFUNDED'
];

const ACTOR_TYPES = ['CUSTOMER', 'ADMIN', 'SYSTEM', 'GATEWAY', 'JOB', 'UNKNOWN'];

const paymentLedgerSchema = new mongoose.Schema(
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
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
      immutable: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      immutable: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true
    },
    eventType: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      immutable: true,
      validate: {
        validator: (value) => /^[A-Z0-9_]{3,80}$/.test(value),
        message: 'Ledger event type is invalid'
      }
    },
    previousStatus: {
      type: String,
      trim: true,
      immutable: true
    },
    currentStatus: {
      type: String,
      required: true,
      trim: true,
      immutable: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      immutable: true
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'INR',
      minlength: 3,
      maxlength: 3,
      immutable: true
    },
    provider: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 80,
      immutable: true
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 200,
      immutable: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true
    },
    actorType: {
      type: String,
      uppercase: true,
      trim: true,
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

paymentLedgerSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: 'string' } }
  }
);
paymentLedgerSchema.index({ paymentId: 1, createdAt: 1 });
paymentLedgerSchema.index({ orderId: 1, createdAt: 1 });
paymentLedgerSchema.index({ userId: 1, createdAt: -1 });
paymentLedgerSchema.index({ eventType: 1, createdAt: -1 });
paymentLedgerSchema.index({ createdAt: -1 });
paymentLedgerSchema.index({ provider: 1, eventType: 1, createdAt: -1 });

const preventMutation = function () {
  throw new Error('Payment ledger is append-only');
};

paymentLedgerSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Payment ledger is append-only');
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
  paymentLedgerSchema.pre(operation, preventMutation);
});

const PaymentLedger = mongoose.model('PaymentLedger', paymentLedgerSchema);

module.exports = PaymentLedger;
module.exports.PAYMENT_LEDGER_EVENTS = PAYMENT_LEDGER_EVENTS;
module.exports.ACTOR_TYPES = ACTOR_TYPES;
