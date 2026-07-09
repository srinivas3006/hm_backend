class ReportGenerator {
  exportReady(type, data, filters = {}) {
    return {
      type,
      generatedAt: new Date(),
      filters,
      data
    };
  }
}

module.exports = new ReportGenerator();
module.exports.ReportGenerator = ReportGenerator;
