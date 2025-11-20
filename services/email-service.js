const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const user = process.env.NOTIFY_EMAIL_USER;
  const pass = process.env.NOTIFY_EMAIL_PASSWORD;

  if (!user || !pass) {
    console.warn(
      '[email-service] NOTIFY_EMAIL_USER / NOTIFY_EMAIL_PASSWORD are not configured. Email notifications are disabled.'
    );
    return null;
  }

  const host = process.env.NOTIFY_EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.NOTIFY_EMAIL_PORT || 465);
  const secure =
    typeof process.env.NOTIFY_EMAIL_SECURE === 'string'
      ? ['true', '1', 'yes'].includes(
          process.env.NOTIFY_EMAIL_SECURE.toLowerCase()
        )
      : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

const sendInspectionAssignmentEmail = async ({ to, subject, text }) => {
  const mailer = getTransporter();

  if (!mailer) {
    return;
  }

  const from =
    process.env.NOTIFY_EMAIL_FROM || process.env.NOTIFY_EMAIL_USER || '';

  if (!to) {
    console.warn('[email-service] No recipient supplied for assignment email.');
    return;
  }

  try {
    await mailer.sendMail({
      from,
      to,
      subject,
      text,
    });
    console.log(`[email-service] Assignment email sent to ${to}`);
  } catch (error) {
    console.error('[email-service] Failed to send assignment email:', error);
    throw error;
  }
};

module.exports = {
  sendInspectionAssignmentEmail,
};

