const crypto = require('crypto');
const mongoose = require('mongoose');

const INVENTORY_RESERVATION_STATUSES = [
  'RESERVED',
  'RELEASED',
  'DEDUCTED',
  'EXPIRED',
  'CANCELLED'
];

const inventoryReservationSchema = new mongoose.Schema(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID()
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: INVENTORY_RESERVATION_STATUSES,
      default: 'RESERVED',
      index: true
    },
    reservedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    releasedAt: {
      type: Date
    },
    deductedAt: {
      type: Date
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
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

inventoryReservationSchema.index(
  { order: 1, payment: 1, book: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'RESERVED' }
  }
);
inventoryReservationSchema.index({ payment: 1, status: 1 });
inventoryReservationSchema.index({ order: 1, status: 1 });
inventoryReservationSchema.index({ book: 1, status: 1 });
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ createdAt: -1 });

const InventoryReservation = mongoose.model('InventoryReservation', inventoryReservationSchema);

module.exports = InventoryReservation;
module.exports.INVENTORY_RESERVATION_STATUSES = INVENTORY_RESERVATION_STATUSES;
