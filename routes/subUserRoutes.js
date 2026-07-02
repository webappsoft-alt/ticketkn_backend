const express = require("express");
const router = express.Router();
const { subUser } = require("../models/subUser");
const authMiddleware = require("../middleware/auth");
const { subUserAuth } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Event = require("../models/Event");
const Purchase = require("../models/Purchase");
const { PrintTicket, AdminTicket } = require("../models/AdminTicket");
const { sendSubUserEmail } = require("../controllers/emailservice");
const config = require("config");
const {
  enrichPurchaseScanInfo,
  enrichPrintTicketScanInfo,
} = require("../utils/scanHelpers");

const accessEventsPopulate = {
  path: "accessEvents",
  populate: [
    { path: "user" },
    {
      path: "purchase_by",
      populate: [{ path: "user", model: "user" }],
    },
    { path: "coupon", model: "Coupon" },
  ],
};
function generateOTP(length = 6, options = { numeric: true, alphabet: false }) {
  let charset = "";

  if (options.numeric) charset += "0123456789";
  if (options.alphabet)
    charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  if (!charset) {
    throw new Error(
      "At least one character set (numeric or alphabet) must be enabled",
    );
  }

  let otp = "";
  for (let i = 0; i < length; i++) {
    const randomIdx = Math.floor(Math.random() * charset.length);
    otp += charset[randomIdx];
  }

  return otp;
}

router.post("/add-user", authMiddleware, async (req, res) => {
  try {
    const { fullName, email, accessEvents } = req.body;
    const isExistingUser = await subUser.findOne({ email });
    if (isExistingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    if (accessEvents) {
      const events = await Event.find({ _id: { $in: accessEvents } });
      if (events.length !== accessEvents.length) {
        return res
          .status(400)
          .json({ success: false, message: "Some events are not found" });
      }
    }
    const mainUser = req.user._id;
    const password = generateOTP(8, { numeric: true, alphabet: true });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new subUser({
      mainUser,
      fullName,
      email,
      password: hashedPassword,
      accessEvents: accessEvents,
    });
    await user.save();
    sendSubUserEmail(email, password);
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/my-details", subUserAuth, async (req, res) => {
  try {
    const user = await subUser
      .findById(req.user._id)
      .populate(accessEventsPopulate)
      .populate({ path: "mainUser", model: "user" })
      .lean();
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/my-scanned-tickets", subUserAuth, async (req, res) => {
  try {
    const subUserId = req.user._id;
    const eventIds = req.user.accessEvents || [];

    const purchases = await Purchase.find({
      event: { $in: eventIds },
      "tickets_type_sale.scannedAtLog.subUser": subUserId,
    })
      .populate("user")
      .populate("event")
      .lean();

    const purchaseScans = purchases.map((purchase) => {
      const scannedAtLog = (
        purchase.tickets_type_sale?.scannedAtLog || []
      ).filter((log) => log.subUser?.toString() === subUserId.toString());

      const filtered = {
        ...purchase,
        tickets_type_sale: {
          ...purchase.tickets_type_sale,
          scannedAtLog,
          scanned: scannedAtLog.map((log) => log.code),
        },
      };
      return enrichPurchaseScanInfo(filtered);
    });

    const printTickets = await PrintTicket.find({ subUser: subUserId }).lean();
    const printTicketIds = printTickets.map((ticket) => ticket._id);

    const adminTickets = await AdminTicket.find({
      tickets: { $in: printTicketIds },
      event: { $in: eventIds },
    })
      .populate("event")
      .lean();

    const eventByTicketId = {};
    for (const adminTicket of adminTickets) {
      for (const ticketId of adminTicket.tickets || []) {
        eventByTicketId[ticketId.toString()] = adminTicket.event;
      }
    }

    const printTicketScans = printTickets
      .filter((ticket) => eventByTicketId[ticket._id.toString()])
      .map((ticket) =>
        enrichPrintTicketScanInfo({
          ...ticket,
          event: eventByTicketId[ticket._id.toString()],
        }),
      );

    res.status(200).json({
      success: true,
      purchaseScans,
      printTicketScans,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/", authMiddleware, async (req, res) => {
  try {
    const subUsers = await subUser
      .find({ mainUser: req.user._id })
      .populate(accessEventsPopulate)
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, subUsers });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await subUser
      .findById(req.params.id)
      .populate(accessEventsPopulate)
      .lean();
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await subUser.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { status: "inactive" } },
      { new: true },
    );
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.put("/active/:id", authMiddleware, async (req, res) => {
  try {
    const user = await subUser
      .findByIdAndUpdate(
        req.params.id,
        { $set: { status: "active" } },
        { new: true },
      )
      .populate("accessEvents")
      .lean();
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.put("/add-access-events/:id", authMiddleware, async (req, res) => {
  try {
    const { accessEvents } = req.body;
    const events = await Event.find({ _id: { $in: accessEvents } }).lean();
    if (events.length !== accessEvents.length) {
      return res
        .status(400)
        .json({ success: false, message: "Some events are not found" });
    }
    const user = await subUser
      .findByIdAndUpdate(
        req.params.id,
        {
          $push: { accessEvents: { $each: events.map((event) => event._id) } },
        },
        { new: true },
      )
      .populate("accessEvents")
      .lean();
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.put("/remove-access-events/:id", authMiddleware, async (req, res) => {
  try {
    const { accessEvents } = req.body;
    if (!accessEvents?.length) {
      return res
        .status(400)
        .json({ success: false, message: "accessEvents is required" });
    }
    const eventIds = accessEvents.map((event) => event?._id ?? event);
    const user = await subUser
      .findByIdAndUpdate(
        req.params.id,
        { $pull: { accessEvents: { $in: eventIds } } },
        { new: true },
      )
      .populate(accessEventsPopulate)
      .lean();
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
function generateToken(user) {
  return jwt.sign(
    { subUser: user._id, mainUser: user.mainUser },
    config.get("jwtPrivateKey"),
    {
      expiresIn: "12h",
    },
  );
}
router.get("generate-sub-user-token/:id", authMiddleware, async (req, res) => {
  try {
    const subUserId = req.params.id;
    const mainUser = req.user._id;
    const user = await subUser.findOne({ mainUser, _id: subUserId });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Sub user not found", success: false });
    }
    const subUserToken = generateToken(user);

    res.status(200).json({ success: true, token: subUserToken });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await subUser
      .findOne({ email })
      .populate(accessEventsPopulate)
      .populate({ path: "mainUser", model: "user" })
      .lean();
    if (!user) {
      return res
        .status(400)
        .json({ message: "Sub user not found", success: false });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ message: "Invalid password", success: false });
    }
    if (user.status === "inactive") {
      return res
        .status(400)
        .json({ message: "User is inactive", success: false });
    }
    const subUserToken = generateToken(user);
    // console.log(user);
    res.status(200).json({ success: true, token: subUserToken, user: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
