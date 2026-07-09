const crypto = require('crypto');
const mongoose = require('mongoose');

const NOTIFICATION_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];
const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'];

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID()
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      required: true,
      index: true
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 300
    },
    body: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: 'PENDING',
      index: true
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    sentAt: {
      type: Date,
      index: true
    },
    failedAt: {
      type: Date
    },
    lastError: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    templateKey: {
      type: String,
      trim: true
    },
    recipient: {
      email: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true
      },
      name: {
        type: String,
        trim: true
      }
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

notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ eventType: 1, createdAt: -1 });
notificationSchema.index({ channel: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;
module.exports.NOTIFICATION_STATUSES = NOTIFICATION_STATUSES;
