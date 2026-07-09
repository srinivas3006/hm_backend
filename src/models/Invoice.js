const crypto = require('crypto');
const mongoose = require('mongoose');

const INVOICE_STATUSES = [
  'GENERATED',
  'VOID',
  'CANCELLED'
];

const invoiceItemSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID()
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      unique: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Invoice requires at least one item'
      }
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    discountTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    shippingTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    total: {
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
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'GENERATED',
      index: true
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    document: {
      contentType: {
        type: String,
        default: 'application/pdf'
      },
      fileName: {
        type: String,
        trim: true
      },
      data: {
        type: Buffer,
        select: false
      },
      generatedAt: {
        type: Date
      },
      template: {
        type: String,
        default: 'standard'
      },
      checksum: {
        type: String,
        trim: true
      }
    },
    regenerationHistory: [
      {
        regeneratedAt: {
          type: Date,
          default: Date.now
        },
        reason: {
          type: String,
          trim: true
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        }
      }
    ],
    taxMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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

invoiceSchema.index({ customer: 1, generatedAt: -1 });
invoiceSchema.index({ status: 1, generatedAt: -1 });
invoiceSchema.index({ generatedAt: -1 });
invoiceSchema.index({ invoiceNumber: 'text' });

module.exports = mongoose.model('Invoice', invoiceSchema);
module.exports.INVOICE_STATUSES = INVOICE_STATUSES;
