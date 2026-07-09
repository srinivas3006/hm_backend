const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    bucketDay: {
      type: String,
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      index: true
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      index: true
    },
    amount: {
      type: Number,
      default: 0
    },
    quantity: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      trim: true
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

analyticsEventSchema.index({ eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ eventType: 1, bucketDay: 1 });
analyticsEventSchema.index({ book: 1, eventType: 1 });
analyticsEventSchema.index({ user: 1, eventType: 1 });
analyticsEventSchema.index({ occurredAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
