const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) {
    console.log('[email-service] Using existing transporter');
    return transporter;
  }

  const user = process.env.NOTIFY_EMAIL_USER;
  const pass = process.env.NOTIFY_EMAIL_PASSWORD;

  console.log('[email-service] Initializing email transporter...');
  console.log('[email-service] Config check:', {
    hasUser: !!user,
    hasPassword: !!pass,
    user: user ? `${user.substring(0, 3)}***` : 'missing',
    host: process.env.NOTIFY_EMAIL_HOST || 'smtp.office365.com (default)',
    port: process.env.NOTIFY_EMAIL_PORT || '587 (default)',
    secure: process.env.NOTIFY_EMAIL_SECURE || 'false (default)',
  });

  if (!user || !pass) {
    console.error(
      '[email-service] ❌ NOTIFY_EMAIL_USER / NOTIFY_EMAIL_PASSWORD are not configured. Email notifications are disabled.'
    );
    console.error('[email-service] Please check config.env file');
    return null;
  }

  // Microsoft 365/Office 365 SMTP configuration
  const host = process.env.NOTIFY_EMAIL_HOST || 'smtp.office365.com';
  const port = Number(process.env.NOTIFY_EMAIL_PORT || 587);
  const secure =
    typeof process.env.NOTIFY_EMAIL_SECURE === 'string'
      ? ['true', '1', 'yes'].includes(
          process.env.NOTIFY_EMAIL_SECURE.toLowerCase()
        )
      : port === 465;

  try {
    const transportConfig = {
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      debug: true, // Enable debug logging
      logger: true, // Enable logger
    };

    // For Microsoft 365 with port 587, use STARTTLS (secure: false, requireTLS: true)
    if (port === 587 && !secure) {
      transportConfig.requireTLS = true;
    }

    transporter = nodemailer.createTransport(transportConfig);

    console.log('[email-service] ✅ Transporter created successfully:', {
      host,
      port,
      secure,
      user: `${user.substring(0, 3)}***`,
    });

    return transporter;
  } catch (error) {
    console.error('[email-service] ❌ Failed to create transporter:', {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
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
    console.log(`[email-service] ✅ Assignment email sent to ${to}`);
  } catch (error) {
    console.error('[email-service] ⚠️ Failed to send assignment email:', error);
    // Don't throw - allow inspection assignment to succeed even if email fails
    // The assignment itself is more important than the notification
    console.warn('[email-service] ⚠️ Inspection assignment will continue despite email failure');
  }
};

const sendInspectionCompletionEmail = async ({
  to,
  organizationName,
  inspectionTitle,
  inspectionId,
  completedAt,
  contactName,
  docxBuffer,
}) => {
  console.log('[email-service] sendInspectionCompletionEmail called:', {
    to,
    organizationName,
    inspectionTitle,
    inspectionId,
    completedAt,
    contactName,
  });

  const mailer = getTransporter();

  if (!mailer) {
    console.warn(
      '[email-service] Email transporter not available. Check NOTIFY_EMAIL_USER and NOTIFY_EMAIL_PASSWORD in config.env'
    );
    return;
  }

  const from =
    process.env.NOTIFY_EMAIL_FROM || process.env.NOTIFY_EMAIL_USER || '';

  console.log('[email-service] Email config:', {
    from,
    to,
    host: process.env.NOTIFY_EMAIL_HOST,
    port: process.env.NOTIFY_EMAIL_PORT,
  });

  if (!to) {
    console.warn('[email-service] No recipient supplied for completion email.');
    return;
  }

  const subject = `Үзлэг дууссан: ${inspectionTitle}`;
  const completedDate = completedAt
    ? new Date(completedAt).toLocaleString('mn-MN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('mn-MN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const greeting = contactName ? `Эрхэм ${contactName},` : 'Эрхэм хэрэглэгч,';

  const text = `
${greeting}

${organizationName} байгууллагын үзлэг амжилттай дууссан тухай мэдэгдэж байна.

Үзлэгийн мэдээлэл:
- Гарчиг: ${inspectionTitle}
- Үзлэгийн ID: ${inspectionId}
- Дууссан огноо: ${completedDate}

Дэлгэрэнгүй мэдээллийг системд нэвтэрч үзнэ үү.

Хүндэтгэсэн,
Inspection App Систем
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border: 1px solid #ddd;
      border-top: none;
    }
    .info-box {
      background-color: white;
      padding: 15px;
      margin: 15px 0;
      border-left: 4px solid #4CAF50;
      border-radius: 4px;
    }
    .info-item {
      margin: 8px 0;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Үзлэг дууссан</h2>
    </div>
    <div class="content">
      <p>${greeting}</p>
      <p>${organizationName} байгууллагын үзлэг амжилттай дууссан тухай мэдэгдэж байна.</p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">Гарчиг:</span> ${inspectionTitle}
        </div>
        <div class="info-item">
          <span class="info-label">Үзлэгийн ID:</span> ${inspectionId}
        </div>
        <div class="info-item">
          <span class="info-label">Дууссан огноо:</span> ${completedDate}
        </div>
      </div>
      
      <p>Дэлгэрэнгүй мэдээллийг системд нэвтэрч үзнэ үү.</p>
    </div>
    <div class="footer">
      <p>Хүндэтгэсэн,<br>Inspection App Систем</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    console.log(`[email-service] Attempting to send email to ${to}...`);
    console.log(`[email-service] Email details:`, {
      from,
      to,
      subject,
      host: process.env.NOTIFY_EMAIL_HOST,
      port: process.env.NOTIFY_EMAIL_PORT,
      secure: process.env.NOTIFY_EMAIL_SECURE,
      hasDocxAttachment: !!docxBuffer,
    });
    
    const mailOptions = {
      from,
      to,
      subject,
      text,
      html,
    };

    // Attach .docx file if provided
    if (docxBuffer) {
      const filename = `inspection-${inspectionId}.docx`;
      mailOptions.attachments = [
        {
          filename,
          content: docxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ];
      console.log(`[email-service] Attaching .docx file: ${filename} (${docxBuffer.length} bytes)`);
    }
    
    const result = await mailer.sendMail(mailOptions);
    
    console.log(`[email-service] ✅ Completion email sent successfully:`, {
      messageId: result.messageId,
      to,
      inspectionId,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending,
      response: result.response,
    });
  } catch (error) {
    console.error('[email-service] ❌ Failed to send completion email:');
    console.error('[email-service] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port,
      stack: error.stack,
    });
    
    // Additional debugging for common Microsoft 365 errors
    if (error.code === 'EAUTH') {
      console.error('[email-service] ⚠️ Authentication error: Check NOTIFY_EMAIL_USER and NOTIFY_EMAIL_PASSWORD in config.env');
      console.error('[email-service] ⚠️ For Microsoft 365, use full email address as username');
      console.error('[email-service] ⚠️ If MFA is enabled, use App Password instead of regular password');
    } else if (error.code === 'ECONNECTION') {
      console.error('[email-service] ⚠️ Connection error: Check internet connection and NOTIFY_EMAIL_HOST');
      console.error('[email-service] ⚠️ For Microsoft 365, host should be smtp.office365.com');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('[email-service] ⚠️ Timeout error: Check network connection and firewall settings');
      console.error('[email-service] ⚠️ Make sure port 587 (TLS) or 465 (SSL) is not blocked by firewall');
    } else if (error.responseCode === 535) {
      if (error.response && error.response.includes('security defaults policy')) {
        console.error('[email-service] ⚠️ ERROR: User is locked by organization\'s Security Defaults policy');
        console.error('[email-service] ⚠️ SOLUTION: SMTP AUTH must be enabled for this mailbox');
        console.error('[email-service] ⚠️ Contact your administrator to enable SMTP AUTH');
        console.error('[email-service] ⚠️ Admin steps: Exchange Admin Center → Mailboxes → Select user → Mail → Enable "Authenticated SMTP"');
        console.error('[email-service] ⚠️ Also check: Set-TransportConfig -SmtpClientAuthenticationDisabled $false');
      } else {
        console.error('[email-service] ⚠️ Microsoft 365 authentication failed: Invalid credentials');
        console.error('[email-service] ⚠️ Check if MFA is enabled - you may need to use App Password');
      }
    } else if (error.responseCode === 550) {
      console.error('[email-service] ⚠️ Microsoft 365 error: Mailbox unavailable or recipient rejected');
    } else if (error.responseCode === 421) {
      console.error('[email-service] ⚠️ Microsoft 365 error: Service not available, try again later');
    }
    
    throw error;
  }
};

module.exports = {
  sendInspectionAssignmentEmail,
  sendInspectionCompletionEmail,
};



