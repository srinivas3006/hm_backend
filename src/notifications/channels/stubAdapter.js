class StubAdapter {
  constructor(channel) {
    this.channel = channel;
  }

  async send() {
    return {
      success: false,
      provider: 'stub',
      error: `${this.channel} adapter is not configured`
    };
  }
}

module.exports = StubAdapter;
