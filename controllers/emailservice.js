require("dotenv").config();

const nodemailer = require("nodemailer");
const logger = require("../startup/logger"); // Adjust the path as needed

exports.sendEmail = async (email, code) => {
  // Create a Nodemailer transporter object
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // SMTP server address for Outlook
    port: 587, // SMTP port
    secure: false, // Set to true for port 465, false for others
    auth: {
      user: "Support@ticketkn.com", // Your Outlook email
      pass: process.env.EMAIL_PASSWORD, // Your Outlook email password or app password
    },
  });

  // Email data
  const mailOptions = {
    from: "Support@ticketkn.com",
    to: email, // Replace with the recipient's email address
    subject: "Tickitts app Verification",
    text: "Your Tickitts app verification code is " + code,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      logger.error("Error sending email: ", error);
    } else {
      logger.info("Email sent: " + info.response);
    }
  });
};

const joiningEmailTemplat = (eventName, eventDate, location, typeTicket) => {
  const template = `<!DOCTYPE html>
     <html lang="en">
     <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <style>
             body {
                 font-family: Arial, sans-serif;
                 margin: 0;
                 padding: 0;
                 background-color: #f4f4f4;
             }
         </style>
     </head>
     <body>
     <div
  style="
    display: flex;
    font-family: Roboto, sans-serif;
    margin: 16px;
    border: 1px solid #ccc;
    position: relative;
  "
>
  <div
    style="position: relative; border-right: 1px dashed #ccc; padding: 24px"
  ></div>
  <div style="padding: 24px; flex: 1">
    <div style="display: flex; margin-bottom: 48px">
      <div style="flex: 1; width: 50%; box-sizing: border-box">
        <span
          style="
            color: #2196f3;
            text-transform: uppercase;
            line-height: 24px;
            font-size: 13px;
            font-weight: 500;
          "
          >Your ticket for</span>
        <strong
          style="font-size: 20px; font-weight: 400; text-transform: uppercase"
          >${eventName}</strong>
      </div>
    </div>
    <div style="display: flex; margin-bottom: 48px">
      <div style="flex: 1; width: 50%; box-sizing: border-box; padding-right: 16px" >
        <span
          style="
            text-transform: uppercase;
            color: #757575;
            font-size: 13px;
            line-height: 24px;
            font-weight: 600;
          "
          >Date and time</span>
        <span
          style="
            font-size: 16px;
            line-height: 24px;
            font-weight: 500;
            color: #2196f3;
          "
          >${eventDate}</span>
        <span style="font-size: 13px; line-height: 24px; font-weight: 500">7:00 am to 9:00 pm (GMT+1)</span>
      </div>
      <div style="flex: 1; width: 50%; box-sizing: border-box">
        <span
          style="
            text-transform: uppercase;
            color: #757575;
            font-size: 13px;
            line-height: 24px;
            font-weight: 600;
          "
          >Location</span
        >
        <span
          style="
            font-size: 16px;
            line-height: 24px;
            font-weight: 500;
            color: #2196f3;
          "
          >${location}</span
        >
      </div>
    </div>
    <div style="display: flex; margin-bottom: 48px">
      <div
        style="flex: 1; width: 50%; box-sizing: border-box; padding-right: 16px"
      >
        <span
          style="
            text-transform: uppercase;
            color: #757575;
            font-size: 13px;
            line-height: 24px;
            font-weight: 600;
          "
          >Ticket type</span
        >
        <span style="font-size: 13px; line-height: 24px; font-weight: 500"
          >${typeTicket}</span
        >
      </div>
    </div>
  </div>
  <div
    style="
      padding: 24px;
      background-color: #2196f3;
      display: flex;
      flex-direction: column;
      position: relative;
    "
  >
    <div style="flex: 1">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Qrcode_wikipedia_fr_v2clean.png"
        style="width: 128px; padding: 4px; background-color: #fff"
      />
    </div>
  </div>
</div>
     </body>
     </html>
     `;

  return template;
};

exports.purchaseEmail = async (
  email,
  eventName,
  eventDate,
  location,
  typeTicket,
) => {
  // Create a Nodemailer transporter object
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // SMTP server address for Outlook
    port: 587, // SMTP port
    secure: false, // Set to true for port 465, false for others
    auth: {
      user: "Support@ticketkn.com", // Your Outlook email
      pass: process.env.EMAIL_PASSWORD, // Your Outlook email password or app password
    },
  });

  const html = joiningEmailTemplat(eventName, eventDate, location, typeTicket);

  // Email data
  const mailOptions = {
    from: "Support@ticketkn.com",
    to: email, // Replace with the recipient's email address
    subject: "Tickitts ticekt purchase",
    html: html,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      logger.error("Error sending email: ", error);
    } else {
      logger.info("Email sent: " + info.response);
    }
  });
};

const subUserEmailTemplate = (email, password) => {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    /* Reset styles for email clients */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body style="background-color: #f4f7fa; margin: 0; padding: 0;">
  <!-- Main wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fa;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <!-- Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header with logo -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center; border-bottom: 1px solid #eef1f5;">
              <img src="https://admin.ticketkn.com/newlogo.png" alt="Tickitts" width="150" style="display: block; margin: 0 auto; max-width: 150px; height: auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 30px;">
              <h2 style="margin: 0 0 16px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 22px; color: #2c3e50; font-weight: 600;">Welcome to the team!</h2>
              <p style="margin: 0 0 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #5a6a7e;">
                A sub‑user account has been created for you on the <strong>Tickitts</strong> platform. Use the credentials below to log in.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Email Address</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #1e293b; font-weight: 500; word-break: break-all;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Password</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #1e293b; font-weight: 500; background-color: #eef2ff; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">${password}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #64748b;">
                For security, please change your password after your first login. If you didn't expect this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; border-top: 1px solid #eef1f5; text-align: center;">
              <p style="margin: 0 0 8px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Tickitts. All rights reserved.
              </p>
              <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">
                Need help? <a href="mailto:support@ticketkn.com" style="color: #2196f3; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
        <!-- End Container -->
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
exports.sendSubUserEmail = async (email, password) => {
  // Create a Nodemailer transporter object
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // SMTP server address for Outlook
    port: 587, // SMTP port
    secure: false, // Set to true for port 465, false for others
    auth: {
      user: "Support@ticketkn.com", // Your Outlook email
      pass: process.env.EMAIL_PASSWORD, // Your Outlook email password or app password
    },
  });

  const html = subUserEmailTemplate(email, password);

  // Email data
  const mailOptions = {
    from: "Support@ticketkn.com",
    to: email, // Replace with the recipient's email address
    subject: "Tickitts ticekt purchase",
    html: html,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      logger.error("Error sending email: ", error);
    } else {
      logger.info("Email sent: " + info.response);
    }
  });
};
