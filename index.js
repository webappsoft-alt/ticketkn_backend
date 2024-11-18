require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const logger = require('./startup/logger'); // Adjust the path as needed


const admin = require("firebase-admin");

const config = {
  "type": process.env.TYPE,
  "project_id":process.env.PROJECTID,
  "private_key_id": process.env.PRIVATE_KEY_ID,
  "private_key":process.env.PRIVATE_KEY,
  "client_email":process.env.CLIENT_EMAIL,
  "client_id": process.env.CLIENTID,
  "auth_uri": process.env.AUTH_URI,
  "token_uri": process.env.TOKEN_URL,
  "auth_provider_x509_cert_url":process.env.AUTHPROVIDER,
  "client_x509_cert_url": process.env.CLIENT_CERT,
  "universe_domain": process.env.DOMAIN
  };


admin.initializeApp({
  credential: admin.credential.cert(config),
  storageBucket: "gs://eventshub-330f9.appspot.com"
});

app.use(cors());

require('./startup/config')();
require('./startup/logging')();
require('./startup/routes')(app);
require('./startup/db')();
require('./startup/validation')();

const port = process.env.PORT || 8080;
const server = app.listen(port, () => logger.info(`Listening on port  ${port}...`));

require('./startup/sockets')(server, app);

// // Privacy Policy HTML
// const privacyPolicyHTML = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Privacy Policy - TicketKn</title>
// </head>
// <body>
//     <h1>Privacy Policy for TicketKn</h1>
//     <p><strong>Effective Date:</strong> 1st November, 2024</p>
//     <p>
//         At TicketKn, we are committed to protecting your privacy and ensuring that your personal information 
//         is handled in a safe and responsible manner. This Privacy Policy outlines the types of information 
//         we collect, how we use it, and how we protect it when you use our platform to buy, sell, or transfer 
//         event tickets.
//     </p>
//     <p>
//         By using TicketKn, you agree to the terms of this Privacy Policy. If you do not agree with this 
//         policy, please do not use our services.
//     </p>
//     <h2>1. Information We Collect</h2>
//     <ul>
//         <li><strong>Personal Information:</strong> When you register or create an account, we collect details such as your name, email address, phone number, and payment information.</li>
//         <li><strong>Transaction Information:</strong> We collect details of your ticket purchases, sales, and transfers, including event details and payment history.</li>
//         <li><strong>Device and Usage Information:</strong> We may collect information about your device (such as IP address, device type, browser type) and how you interact with our platform (such as pages viewed, transaction data, and usage statistics).</li>
//     </ul>
//     <h2>2. How We Use Your Information</h2>
//     <ul>
//         <li>Provide and maintain the services you request (buying, selling, and transferring tickets).</li>
//         <li>Process transactions and payments securely.</li>
//         <li>Communicate with you about your account, ticket orders, and promotions.</li>
//         <li>Improve our app, services, and user experience.</li>
//         <li>Comply with legal obligations and resolve disputes.</li>
//     </ul>
//     <h2>3. Data Sharing</h2>
//     <ul>
//         <li><strong>Service Providers:</strong> We may share your information with trusted third-party service providers who assist in operating our platform, processing payments, or providing customer support.</li>
//         <li><strong>Legal Compliance:</strong> We may disclose your information if required by law, such as in response to a subpoena or other legal processes.</li>
//         <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new entity.</li>
//     </ul>
//     <h2>4. Data Security</h2>
//     <p>
//         We implement industry-standard security measures to protect your personal information, including encryption, secure servers, and access control. However, no system is completely secure, and we cannot guarantee the absolute security of your data.
//     </p>
//     <h2>5. Your Rights and Choices</h2>
//     <ul>
//         <li><strong>Access and Update Your Information:</strong> You can view and update your account information at any time.</li>
//         <li><strong>Delete Your Account:</strong> You may request to delete your account by contacting us. Note that some information may be retained for legal or operational reasons.</li>
//         <li><strong>Opt-Out of Marketing Communications:</strong> You can unsubscribe from marketing emails by clicking the "unsubscribe" link in any email we send you.</li>
//     </ul>
//     <h2>6. Children’s Privacy</h2>
//     <p>
//         TicketKn is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information.
//     </p>
//     <h2>7. Changes to This Privacy Policy</h2>
//     <p>
//         We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Any updates will be posted on this page, and the "Effective Date" will be updated accordingly.
//     </p>
//     <h2>8. Contact Us</h2>
//     <p>
//         If you have any questions about this Privacy Policy or how we handle your data, please contact us at:
//     </p>
//     <ul>
//         <li>Email: <a href="mailto:Support@ticketkn.com">Support@ticketkn.com</a></li>
//         <li>Address: C15 Sands Complex</li>
//     </ul>
// </body>
// </html>
// `;

// // API Endpoint to Serve Privacy Policy
// app.get('/privacy', (req, res) => {
//     res.setHeader('Content-Type', 'text/html');
//     res.send(privacyPolicyHTML);
// });


module.exports = server;