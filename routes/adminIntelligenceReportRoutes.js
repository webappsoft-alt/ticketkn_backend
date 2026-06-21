const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const admin = require("../middleware/admin");
const intelligenceReportController = require("../controllers/intelligenceReportController");

router.get(
  "/",
  [authMiddleware, admin],
  intelligenceReportController.adminListReports,
);

router.patch(
  "/:reportId",
  [authMiddleware, admin],
  intelligenceReportController.adminUpdateReport,
);

module.exports = router;
