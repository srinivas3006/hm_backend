const emailAdapter = require('./emailAdapter');
const StubAdapter = require('./stubAdapter');

module.exports = {
  EMAIL: emailAdapter,
  SMS: new StubAdapter('SMS'),
  WHATSAPP: new StubAdapter('WHATSAPP'),
  PUSH: new StubAdapter('PUSH'),
  IN_APP: new StubAdapter('IN_APP')
};
