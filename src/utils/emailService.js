const { Resend } = require('resend');
const logger = require('./logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY is not set. Email not sent.');
      return false;
    }

    const data = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to}: ${data.id}`);
    return true;
  } catch (error) {
    logger.error(`Error sending email to ${to}: ${error.message}`);
    return false;
  }
};

const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Harglim Publishers!';
  const html = `
    <h1>Welcome, ${user.name}!</h1>
    <p>Thank you for joining Harglim Publishers. We are excited to have you on board.</p>
    <p>You can now browse our vast collection of books, or if you're an author, you can submit your manuscripts for publishing.</p>
    <br/>
    <p>Best Regards,</p>
    <p>The Harglim Team</p>
  `;
  return sendEmail({ to: user.email, subject, html });
};

const sendOrderConfirmation = async (user, order) => {
  const subject = `Order Confirmation: ${order.orderNumber}`;
  const html = `
    <h1>Thank you for your order, ${user.name}!</h1>
    <p>We have received your order <strong>${order.orderNumber}</strong>.</p>
    <p><strong>Total Amount:</strong> ₹${order.totalPrice}</p>
    <p>We will notify you once your order is processed and shipped.</p>
    <br/>
    <p>Best Regards,</p>
    <p>The Harglim Team</p>
  `;
  return sendEmail({ to: user.email, subject, html });
};

const sendPublishRequestUpdate = async (user, request, status) => {
  const subject = `Publish Request Update: ${request.title}`;
  const html = `
    <h1>Hello ${user.name},</h1>
    <p>The status of your publish request for <strong>"${request.title}"</strong> has been updated to: <strong>${status.toUpperCase()}</strong>.</p>
    <p>Log in to your author dashboard for more details.</p>
    <br/>
    <p>Best Regards,</p>
    <p>The Harglim Team</p>
  `;
  return sendEmail({ to: user.email, subject, html });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendPublishRequestUpdate
};
