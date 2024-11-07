require('dotenv').config();

const nodemailer = require('nodemailer');
const logger = require('../startup/logger'); // Adjust the path as needed

exports.sendEmail = async (email, code) => {
     // Create a Nodemailer transporter object
     const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com', // SMTP server address for Outlook
          port: 587, // SMTP port
          secure: false, // Set to true for port 465, false for others
          auth: {
            user: 'Support@ticketkn.com', // Your Outlook email
            pass: process.env.EMAIL_PASSWORD // Your Outlook email password or app password
          }
     });

     // Email data
     const mailOptions = {
          from: 'Support@ticketkn.com',
          to: email, // Replace with the recipient's email address
          subject: 'TicketKN app Verification',
          text: 'Your TicketKN app verification code is ' + code,
     };

     // Send the email
     transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
               logger.error('Error sending email: ', error);
          } else {
               logger.info('Email sent: ' + info.response);
          }
     });
}
