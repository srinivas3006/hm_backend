const getPaymentConfig = () => ({
  upi: {
    merchantUpiId: process.env.MERCHANT_UPI_ID,
    merchantName: process.env.MERCHANT_NAME,
    merchantCode: process.env.MERCHANT_CODE,
    currency: process.env.PAYMENT_CURRENCY || 'INR',
    qrExpiryMinutes: Number(process.env.QR_EXPIRY_MINUTES || 15)
  }
});

module.exports = getPaymentConfig;
