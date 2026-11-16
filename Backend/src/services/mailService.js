import nodemailer from 'nodemailer';

/**
 * Configure Nodemailer transport for Gmail with strict timeout safeguards
 */
function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // Fallback mode
  }

  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const isSecure = port === 465;

  return nodemailer.createTransport({
    // Using service: 'gmail' uses optimal direct SSL settings for Gmail
    service: !process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.gmail.com' ? 'gmail' : undefined,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    // Strict connection timeouts to prevent hanging on cloud hosts (like Render free tier)
    connectionTimeout: 4000, // 4s max to establish TCP socket
    greetingTimeout: 4000,   // 4s max for SMTP handshake
    socketTimeout: 5000,     // 5s max for socket inactivity
  });
}

/**
 * Send an email invitation to join a project team
 */
export async function sendProjectInvitationEmail({
  toEmail,
  inviterName,
  projectName,
  role = 'member',
  token,
}) {
  const cleanBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const inviteLink = `${cleanBase}/invite/accept?token=${encodeURIComponent(token)}`;
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #091e42; color: #172b4d; margin: 0; padding: 20px; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .header { background: #0052cc; padding: 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 28px; line-height: 1.6; color: #172b4d; }
          .badge { display: inline-block; background: #deebff; color: #0747a6; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 13px; text-transform: uppercase; }
          .project-card { background: #f4f5f7; border: 1px solid #dfe1e6; border-radius: 6px; padding: 16px; margin: 20px 0; }
          .btn { display: inline-block; background-color: #0052cc; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: 600; font-size: 15px; text-align: center; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,82,204,0.3); }
          .notice-box { background: #e3fcef; border: 1px solid #abf5d1; border-radius: 6px; padding: 12px 16px; color: #006644; font-size: 13px; margin: 16px 0; }
          .footer { background: #fafbfc; border-top: 1px solid #ebecf0; padding: 16px 28px; font-size: 12px; color: #6b778c; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>NexusFlow Workspace</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> has invited your Gmail (<code>${toEmail}</code>) to join the project team:</p>
            <div class="project-card">
              <h2 style="margin: 0 0 6px 0; font-size: 18px; color: #172b4d;">${projectName}</h2>
              <span class="badge">Role: ${role}</span>
            </div>
            <div class="notice-box">
              🔒 <strong>Verification Required:</strong> You must verify via this Gmail address to join the workspace and collaborate on issues.
            </div>
            <p>Click the button below to verify your email and activate your team membership:</p>
            <div style="text-align: center;">
              <a href="${inviteLink}" class="btn" target="_blank">Verify Gmail & Join Team</a>
            </div>
            <p style="font-size: 13px; color: #6b778c; margin-top: 24px;">
              Or copy and paste this verification URL into your browser:<br/>
              <a href="${inviteLink}" style="color: #0052cc; word-break: break-all;">${inviteLink}</a>
            </p>
            <p style="font-size: 12px; color: #97a0af;">This verification link will expire in 7 days.</p>
          </div>
          <div class="footer">
            Sent by NexusFlow &bull; Next-Gen Agile Workspace & Collaborative Data Architecture Platform
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n========================================================');
    console.log('📨 [DEV MODE / SMTP NOT CONFIGURED] EMAIL INVITATION GENERATED');
    console.log(`To: ${toEmail}`);
    console.log(`Invited by: ${inviterName}`);
    console.log(`Project: ${projectName} (${role})`);
    console.log(`👉 ACCEPT LINK: ${inviteLink}`);
    console.log('💡 Note: Set SMTP_USER and SMTP_PASS in Backend/.env to send real Gmail emails.');
    console.log('========================================================\n');
    return {
      success: true,
      delivered: false,
      mode: 'dev-preview',
      inviteLink,
      message: 'Invitation link generated. SMTP credentials not set, printed to console.',
    };
  }

  try {
    const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;

    const sendPromise = transporter.sendMail({
      from: `"NexusFlow Workspace" <${fromAddress}>`,
      to: toEmail,
      subject: `[Invitation] ${inviterName} invited you to join "${projectName}"`,
      html: htmlContent,
    });

    // 4000ms safety timeout: prevents request from hanging if cloud host (Render) drops SMTP port
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'SMTP connection timed out (4s). Cloud provider (Render) may block outbound SMTP traffic on ports 587/465.'
            )
          ),
        4000
      )
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);

    console.log(`✅ Real Gmail invitation sent to ${toEmail}. MessageId: ${info.messageId}`);
    return {
      success: true,
      delivered: true,
      mode: 'smtp-gmail',
      inviteLink,
      messageId: info.messageId,
    };
  } catch (err) {
    console.warn(`⚠️ Notice: Could not deliver email directly via SMTP (${err.message}). Safe fallback engaged.`);
    // Return the invite link anyway so the invitation workflow never hangs or blocks the user
    return {
      success: true,
      delivered: false,
      mode: 'smtp-fallback-link',
      inviteLink,
      error: err.message,
    };
  }
}

