class PlaceholderCourierAdapter {
  constructor(provider) {
    this.provider = provider;
  }

  async assign() {
    throw new Error(`${this.provider} courier integration is not configured`);
  }
}

module.exports = PlaceholderCourierAdapter;
