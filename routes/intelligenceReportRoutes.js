const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const intelligenceReportController = require("../controllers/intelligenceReportController");

router.post(
  "/request",
  authMiddleware,
  intelligenceReportController.createRequest,
);

router.get(
  "/event/:eventId",
  authMiddleware,
  intelligenceReportController.getReportByEvent,
);

module.exports = router;
