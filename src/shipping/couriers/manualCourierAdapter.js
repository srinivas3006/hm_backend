const crypto = require('crypto');

class ManualCourierAdapter {
  constructor({ provider = 'manual' } = {}) {
    this.provider = provider;
  }

  async assign(shipment, options = {}) {
    const trackingNumber = options.trackingNumber || `MAN-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    return {
      provider: this.provider,
      serviceName: options.serviceName || 'Manual Courier',
      trackingNumber,
      trackingUrl: options.trackingUrl || `/track/${trackingNumber}`,
      estimatedDelivery: options.estimatedDelivery,
      description: 'Manual courier assigned'
    };
  }
}

module.exports = new ManualCourierAdapter();
module.exports.ManualCourierAdapter = ManualCourierAdapter;
