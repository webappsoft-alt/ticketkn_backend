const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/all/:id?', notificationController.getApplicationDetails);
router.get('/check-seen', notificationController.checkSeen);
router.delete('/delete-all', notificationController.deleteAllNoti);
router.delete('/:id', notificationController.deletenotification);

module.exports = router;
