const nodemailer = require("nodemailer");

/**
 * Helper to send email or log to console in development
 * @param {Object} options - Options containing email, subject, text, and html content
 */
const sendEmail = async (options) => {
  // Check if SMTP environment variables are configured
  const isSmtpConfigured =
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS;

  if (!isSmtpConfigured) {
    console.log("\n==================================================");
    console.log("📨  [SIMULATED EMAIL SENT]");
    console.log(`To:      ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log("--------------------------------------------------");
    console.log(options.text);
    console.log("==================================================\n");
    return { status: "simulated", message: "Email logged to console" };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Mail options
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"CampusLink" <noreply@campuslink.edu>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  // Send mail
  const info = await transporter.sendMail(mailOptions);
  console.log(`📨 Email sent successfully: ${info.messageId}`);
  return info;
};

module.exports = sendEmail;
