require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const logger = require('./startup/logger'); // Adjust the path as needed
const nodeCron = require("node-cron");
const { CheckCoupons } = require('./controllers/CheckCoupons');


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
  storageBucket: "gs://demoproject-158d6.appspot.com"
});

app.use(cors());

require('./startup/config')();
require('./startup/logging')();
require('./startup/routes')(app);
require('./startup/db')();
require('./startup/validation')();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => logger.info(`Listening on port  ${port}...`));

require('./startup/sockets')(server, app);

const job = nodeCron.schedule('*/30 * * * *', CheckCoupons);

// const job = nodeCron.schedule('*/30 * * * * *', CheckCoupons);

job.start()


module.exports = server;