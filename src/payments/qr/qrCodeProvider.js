class QRCodeProvider {
  async generate() {
    throw new Error('QRCodeProvider.generate must be implemented by a provider');
  }
}

module.exports = QRCodeProvider;
