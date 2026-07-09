const crypto = require('crypto');
const mongoose = require('mongoose');

const SHIPMENT_STATUSES = [
  'CREATED',
  'COURIER_ASSIGNED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED'
];

const shipmentTrackingEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      required: true
    },
    location: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    occurredAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const shipmentPackageSchema = new mongoose.Schema(
  {
    packageId: {
      type: String,
      default: () => crypto.randomUUID()
    },
    items: [
      {
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Book'
        },
        quantity: {
          type: Number,
          min: 1
        }
      }
    ],
    weightGrams: {
      type: Number,
      min: 0
    },
    dimensions: {
      lengthCm: Number,
      widthCm: Number,
      heightCm: Number
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    shipmentId: {
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
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    courier: {
      provider: {
        type: String,
        lowercase: true,
        trim: true,
        default: 'manual'
      },
      serviceName: {
        type: String,
        trim: true
      },
      assignedAt: {
        type: Date
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    trackingNumber: {
      type: String,
      uppercase: true,
      trim: true
    },
    trackingUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: 'CREATED',
      index: true
    },
    pickupDate: {
      type: Date
    },
    dispatchDate: {
      type: Date
    },
    deliveryDate: {
      type: Date
    },
    estimatedDelivery: {
      type: Date
    },
    packages: {
      type: [shipmentPackageSchema],
      default: []
    },
    trackingHistory: {
      type: [shipmentTrackingEventSchema],
      default: []
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    audit: {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

shipmentSchema.index(
  { order: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true }
  }
);
shipmentSchema.index(
  { trackingNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { trackingNumber: { $type: 'string' } }
  }
);
shipmentSchema.index({ customer: 1, createdAt: -1 });
shipmentSchema.index({ status: 1, createdAt: -1 });
shipmentSchema.index({ 'courier.provider': 1, status: 1 });
shipmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
module.exports.SHIPMENT_STATUSES = SHIPMENT_STATUSES;
