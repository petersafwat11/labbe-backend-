const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, // This will bypass the SSL certificate verification
      },
    });

    // Define email options
    const mailOptions = {
      from: `Labbe <${process.env.EMAIL_USERNAME}>`,
      to: options.email,
      subject: options.subject,
    };

    // Check if custom HTML is provided, otherwise use the message as HTML
    if (options.html) {
      mailOptions.html = options.html;
    } else if (options.message) {
      // If message contains HTML tags, use it as HTML, otherwise wrap in basic HTML
      if (options.message.includes("<")) {
        mailOptions.html = options.message;
      } else {
        // For backward compatibility with password reset (when message is just a URL)
        if (options.subject.toLowerCase().includes("password reset")) {
          mailOptions.html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>You requested a password reset. Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${options.message}" 
                   style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this, please ignore this email. This link will expire in 10 minutes.
              </p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                This is an automated message, please do not reply to this email.
              </p>
            </div>
          `;
        } else {
          // For other emails, wrap in basic HTML
          mailOptions.html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="padding: 20px;">
                ${options.message}
              </div>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                This is an automated message, please do not reply to this email.
              </p>
            </div>
          `;
        }
      }
    } else {
      throw new Error("Email content (message or html) is required");
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email. Please try again later.");
  }
};

module.exports = sendEmail;
