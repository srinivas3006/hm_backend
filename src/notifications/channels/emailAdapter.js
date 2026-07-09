const { sendEmail } = require('../../utils/emailService');

class EmailAdapter {
  constructor(sender = sendEmail) {
    this.sender = sender;
  }

  async send(notification) {
    if (!notification.recipient || !notification.recipient.email) {
      return {
        success: false,
        error: 'Email recipient is missing'
      };
    }

    const success = await this.sender({
      to: notification.recipient.email,
      subject: notification.subject,
      html: notification.body
    });

    return {
      success: Boolean(success),
      provider: 'resend',
      error: success ? undefined : 'Email provider returned unsuccessful result'
    };
  }
}

module.exports = new EmailAdapter();
module.exports.EmailAdapter = EmailAdapter;
