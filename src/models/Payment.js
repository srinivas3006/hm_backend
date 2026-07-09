const mongoose = require('mongoose');

const PAYMENT_STATUSES = [
  'INTENT_CREATED',
  'QR_PENDING',
  'QR_GENERATED',
  'PAYMENT_PENDING',
  'PENDING',
  'PAYMENT_SUBMITTED',
  'SUBMITTED',
  'VERIFICATION_PENDING',
  'PAYMENT_VERIFIED',
  'VERIFIED',
  'PAYMENT_REJECTED',
  'PAYMENT_FAILED',
  'FAILED',
  'PAYMENT_EXPIRED',
  'PAYMENT_CANCELLED',
  'EXPIRED',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUND_APPROVED',
  'REFUNDED'
];

const SUCCESSFUL_PAYMENT_STATUSES = [
  'PAYMENT_VERIFIED',
  'VERIFIED',
  'REFUND_REQUESTED',
  'REFUND_APPROVED',
  'REFUNDED'
];

const paymentStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const paymentRefundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'REQUESTED'
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    processedAt: {
      type: Date
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'INR',
      minlength: 3,
      maxlength: 3
    },
    paymentMethod: {
      type: String,
      uppercase: true,
      trim: true,
      enum: ['UPI', 'CARD', 'NET_BANKING', 'WALLET', 'CASH', 'OTHER'],
      default: 'UPI'
    },
    provider: {
      type: String,
      lowercase: true,
      trim: true,
      default: 'manual_upi',
      maxlength: 80
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'INTENT_CREATED',
      index: true
    },
    attemptNumber: {
      type: Number,
      min: 1,
      default: 1
    },
    utr: {
      type: String,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]{6,64}$/, 'Please add a valid UTR or transaction reference']
    },
    providerOrderId: {
      type: String,
      trim: true,
      maxlength: 150
    },
    providerPaymentId: {
      type: String,
      trim: true,
      maxlength: 150
    },
    providerSignature: {
      type: String,
      select: false,
      trim: true
    },
    qrPayload: {
      type: String,
      select: false
    },
    qrCodeDataUrl: {
      type: String,
      select: false
    },
    qrGeneratedAt: {
      type: Date
    },
    qrExpiresAt: {
      type: Date
    },
    qrMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    expiresAt: {
      type: Date
    },
    submittedAt: {
      type: Date
    },
    verifiedAt: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    successfulPayment: {
      type: Boolean,
      default: false,
      index: true
    },
    activeIntent: {
      type: Boolean,
      default: false,
      index: true
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
      default: {}
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    statusHistory: {
      type: [paymentStatusHistorySchema],
      default: []
    },
    refunds: {
      type: [paymentRefundSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ provider: 1, status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, expiresAt: 1 });
paymentSchema.index(
  { provider: 1, providerOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerOrderId: { $type: 'string' } }
  }
);
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerPaymentId: { $type: 'string' } }
  }
);
paymentSchema.index(
  { utr: 1 },
  {
    unique: true,
    partialFilterExpression: { utr: { $type: 'string' } }
  }
);
paymentSchema.index(
  { order: 1, successfulPayment: 1 },
  {
    unique: true,
    partialFilterExpression: { successfulPayment: true }
  }
);
paymentSchema.index(
  { order: 1, activeIntent: 1 },
  {
    name: 'unique_active_payment_intent_per_order',
    unique: true,
    partialFilterExpression: { activeIntent: true }
  }
);

paymentSchema.pre('validate', function () {
  this.successfulPayment = SUCCESSFUL_PAYMENT_STATUSES.includes(this.status);

  if (['PAYMENT_SUBMITTED', 'SUBMITTED'].includes(this.status) && !this.submittedAt) {
    this.submittedAt = new Date();
  }

  if (['PAYMENT_VERIFIED', 'VERIFIED'].includes(this.status) && !this.verifiedAt) {
    this.verifiedAt = new Date();
  }

  if (this.status === 'PAYMENT_REJECTED' && !this.rejectedAt) {
    this.rejectedAt = new Date();
  }
});

paymentSchema.methods.addStatusHistory = function (status, options = {}) {
  this.statusHistory.push({
    status,
    changedBy: options.changedBy,
    reason: options.reason,
    metadata: options.metadata || {}
  });
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.SUCCESSFUL_PAYMENT_STATUSES = SUCCESSFUL_PAYMENT_STATUSES;
