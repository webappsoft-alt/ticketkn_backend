const express = require("express");
const router = express.Router();
const { subUser } = require("../models/subUser");
const authMiddleware = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { sendSubUserEmail } = require("../controllers/emailservice");
const config = require("config");
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
    const { fullName, email } = req.body;
    const isExistingUser = await subUser.findOne({ email });
    if (isExistingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    const mainUser = req.user._id;
    const password = generateOTP(8, { numeric: true, alphabet: true });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new subUser({
      mainUser,
      fullName,
      email,
      password: hashedPassword,
    });
    await user.save();
    sendSubUserEmail(email, password);
    res.status(200).json({ success: true, subUser: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const subUsers = await subUser.find({ mainUser: req.user._id });
    res.status(200).json({ success: true, subUsers });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await subUser.findById(req.params.id);
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
      { status: "inactive" },
      { new: true },
    );
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
    const user = await subUser.findOne({ email });
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
    res.status(200).json({ success: true, token: subUserToken });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
