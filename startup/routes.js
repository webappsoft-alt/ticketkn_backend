const express = require('express');
const error = require('../middleware/error');
const auth = require('../routes/auth');
const users = require('../routes/users');
const uploadImages = require('../routes/uploadImages');
const postRoutes = require('../routes/postRoutes');
// const programRoutes = require('../routes/programRoutes');
// const foodRoutes = require('../routes/foodRoutes');
// const messageRoutes = require('../routes/messageRoutes');
// const notificationRoute = require('../routes/notificationRoute');
// const ratingRoutes = require('../routes/ratingRoutes');
const authMiddleware = require('../middleware/auth');
// const supportRoute = require('../routes/supportRoute');

module.exports = function (app) {
  app.use(express.json());
  app.use('/api/auth', auth);
  app.use('/api/users', users);
  app.use('/api/image', uploadImages);
  app.use('/api/event', authMiddleware, postRoutes);
  // app.use('/api/program', authMiddleware,programRoutes);
  // app.use('/api/food', authMiddleware,foodRoutes);
  // app.use('/api/msg',authMiddleware, messageRoutes);
  // app.use('/api/notification',authMiddleware, notificationRoute);
  // app.use('/api/rating',authMiddleware, ratingRoutes);
  // app.use('/api/support', supportRoute);
  app.use(error);
}