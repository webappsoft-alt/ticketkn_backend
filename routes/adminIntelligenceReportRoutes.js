const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const admin = require("../middleware/admin");
const intelligenceReportController = require("../controllers/intelligenceReportController");

router.get(
  "/count",
  [authMiddleware, admin],
  intelligenceReportController.adminReportCounts,
);

router.put(
  "/seen",
  [authMiddleware, admin],
  intelligenceReportController.adminMarkReportsSeen,
);

router.get(
  "/",
  [authMiddleware, admin],
  intelligenceReportController.adminListReports,
);

router.put(
  "/:reportId",
  [authMiddleware, admin],
  intelligenceReportController.adminUpdateReport,
);

module.exports = router;
