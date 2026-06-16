const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const analyticsController = require("../controllers/analyticsController");
const admin = require("../middleware/admin");


router.get("/break-even", [auth, admin], analyticsController.breakEven);
router.get(
  "/attendee-demographics",
  [auth, admin],
  analyticsController.attendeeDemographics,
);
router.get("/event-comparison", [auth, admin], analyticsController.eventComparison);
router.get("/revenue-forecast", [auth, admin], analyticsController.revenueForecast);

module.exports = router;
