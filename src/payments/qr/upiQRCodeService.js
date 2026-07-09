const QRCode = require('qrcode');
const QRCodeProvider = require('./qrCodeProvider');
const getPaymentConfig = require('../../config/payment');

class QRConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QRConfigurationError';
    this.code = 'QR_CONFIGURATION_ERROR';
    this.details = details;
  }
}

class QRValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QRValidationError';
    this.code = 'QR_VALIDATION_ERROR';
    this.details = details;
  }
}

const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{2,64}$/;

const formatAmount = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new QRValidationError('Amount must be a positive number', { amount });
  }

  return numericAmount.toFixed(2);
};

const appendIfPresent = (params, key, value) => {
  if (value !== undefined && value !== null && value !== '') {
    params.set(key, String(value));
  }
};

class UPIQRCodeService extends QRCodeProvider {
  constructor(configFactory = getPaymentConfig) {
    super();
    this.configFactory = configFactory;
  }

  async generate(payload, options = {}) {
    const config = {
      ...this.configFactory().upi,
      ...options.config
    };

    this.validateConfig(config);
    this.validatePayload(payload);

    const upiUri = this.buildUPIUri(payload, config);
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin === undefined ? 2 : options.margin,
      width: options.width || 320
    });

    return {
      provider: 'manual_upi',
      type: 'DYNAMIC_UPI_QR',
      upiUri,
      qrCodeDataUrl,
      metadata: {
        payeeName: config.merchantName,
        upiId: config.merchantUpiId,
        amount: formatAmount(payload.amount),
        currency: payload.currency || config.currency || 'INR',
        transactionNote: payload.transactionNote,
        orderReference: payload.orderReference,
        intentId: payload.intentId,
        transactionReference: payload.transactionReference,
        merchantCode: config.merchantCode
      }
    };
  }

  buildUPIUri(payload, config) {
    const params = new URLSearchParams();
    const currency = payload.currency || config.currency || 'INR';
    const transactionNote = payload.transactionNote || `Order ${payload.orderReference}`;

    params.set('pa', config.merchantUpiId);
    params.set('pn', config.merchantName);
    params.set('am', formatAmount(payload.amount));
    params.set('cu', currency);
    appendIfPresent(params, 'tn', transactionNote);
    appendIfPresent(params, 'tr', payload.transactionReference || payload.intentId || payload.orderReference);
    appendIfPresent(params, 'mc', config.merchantCode);

    return `upi://pay?${params.toString()}`;
  }

  validateConfig(config) {
    if (!config.merchantUpiId || !UPI_ID_PATTERN.test(config.merchantUpiId)) {
      throw new QRConfigurationError('A valid merchant UPI ID is required');
    }

    if (!config.merchantName || String(config.merchantName).trim().length < 2) {
      throw new QRConfigurationError('A valid merchant name is required');
    }
  }

  validatePayload(payload) {
    if (!payload) {
      throw new QRValidationError('QR payload is required');
    }

    formatAmount(payload.amount);

    if (!payload.orderReference) {
      throw new QRValidationError('Order reference is required');
    }

    if (!payload.intentId) {
      throw new QRValidationError('Payment intent id is required');
    }
  }
}

module.exports = new UPIQRCodeService();
module.exports.UPIQRCodeService = UPIQRCodeService;
module.exports.QRConfigurationError = QRConfigurationError;
module.exports.QRValidationError = QRValidationError;
