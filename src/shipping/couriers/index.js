const manualCourierAdapter = require('./manualCourierAdapter');
const PlaceholderCourierAdapter = require('./placeholderCourierAdapter');

module.exports = {
  manual: manualCourierAdapter,
  shiprocket: new PlaceholderCourierAdapter('shiprocket'),
  delhivery: new PlaceholderCourierAdapter('delhivery'),
  bluedart: new PlaceholderCourierAdapter('bluedart'),
  dtdc: new PlaceholderCourierAdapter('dtdc'),
  indiapost: new PlaceholderCourierAdapter('indiapost')
};
