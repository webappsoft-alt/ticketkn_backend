const auth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const _ = require("lodash");
const {
  User,
  validate,
  generateAuthToken,
  passwordApiBodyValidate,
  generateIdToken,
  emailApiBodyValidate,
  phoneApiBodyValidate,
} = require("../models/user");
const express = require("express");
const { sendEmail } = require("../controllers/emailservice");
const passwordauth = require("../middleware/passwordauth");
const { generateCode } = require("../controllers/generateCode");
const router = express.Router();
const { TempUser } = require("../models/TempUser");

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password").lean();
  res.send({ success: true, user: user });
});

router.post("/forget-password", async (req, res) => {
  const { error } = emailApiBodyValidate(req.body);

  if (error) return res.status(400).send({ message: error.details[0].message });

  const { email } = req.body;
  const lowerCaseEmail = String(email).trim().toLocaleLowerCase();

  const user = await User.findOne({ email: lowerCaseEmail });

  if (!user)
    return res
      .status(400)
      .send({
        message: "User is not registered with that Phone number or email",
      });

  if (user.status == "deleted")
    return res
      .status(400)
      .send({
        message: "User has been deleted. Contact admin for further support.",
      });

  let verificationCode = generateCode();

  await sendEmail(email, verificationCode);
  await User.findOneAndUpdate(
    { email: lowerCaseEmail },
    { code: verificationCode }
  );

  const token = generateIdToken(user._id);

  res.send({
    success: true,
    message: "Verification code sent successfully",
    token,
    verificationCode,
  });
});

router.put("/update-password", passwordauth, async (req, res) => {
  const { error } = passwordApiBodyValidate(req.body);
  if (error)
    return res
      .status(400)
      .send({ success: false, message: error.details[0].message });

  const { password } = req.body;

  const user = await User.findById(req.user._id);

  if (!user)
    return res
      .status(400)
      .send({
        success: false,
        message: "The User with the given ID was not found.",
      });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  user.password = hashedPassword;

  await user.save();

  res.send({ success: true, message: "Password updated successfully" });
});

router.put("/change-password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  if (!user)
    return res
      .status(400)
      .send({
        success: false,
        message: "The User with the given ID was not found.",
      });

  const validPassword = await bcrypt.compare(oldPassword, user.password);
  if (!validPassword)
    return res
      .status(400)
      .send({ success: false, message: "Invalid password" });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;

  await user.save();

  res.send({ success: true, message: "Password updated successfully" });
});

router.post("/send-code", async (req, res) => {
  const { error } = emailApiBodyValidate(req.body);
  if (error)
    return res
      .status(400)
      .send({ success: false, message: error.details[0].message });

  const { email } = req.body;
  const lowerCaseEmail = String(email).trim().toLocaleLowerCase();

  try {
    const existingUser = await User.findOne({ email: lowerCaseEmail });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const verificationCode = generateCode();
    await sendEmail(email, verificationCode);

    const existingTempUser = await TempUser.findOne({ email: lowerCaseEmail });
    if (existingTempUser) {
      await TempUser.findByIdAndUpdate(existingTempUser._id, {
        code: verificationCode,
      });
    } else {
      const tempVerification = new TempUser({
        email: lowerCaseEmail,
        code: verificationCode,
      });
      await tempVerification.save();
    }
    return res.json({
      message: "Verification code sent successfully",
      verificationCode,
    });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/verify-otp/registration", async (req, res) => {
  try {
    const { email, code } = req.body;

    const lowerCaseEmail = String(email).trim().toLocaleLowerCase();

    const verificationRecord = await TempUser.findOne({
      email: lowerCaseEmail,
    });

    if (!verificationRecord || verificationRecord.code !== code) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect verification code" });
    }

    return res.json({
      success: true,
      message: "Verification code match successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { error } = validate(req.body);
    if (error)
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });

    const { name, password, email, fcmtoken,age,weight,gender,height } = req.body;

    const lowerCaseEmail = String(email).trim().toLocaleLowerCase();

    const verificationRecord = await TempUser.findOne({
      email: lowerCaseEmail,
    });

    if (!verificationRecord)
      return res
        .status(400)
        .json({ success: false, message: "Verification is not completed" });

    const user = await User.findOne({ email: lowerCaseEmail });

    if (user)
      return res
        .status(400)
        .send({ success: false, message: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      password: hashedPassword,
      name,
      email: lowerCaseEmail,
      fcmtoken,
      type: "customer",age,weight,gender,height
    });

    await newUser.save();
    await TempUser.deleteOne({ email: lowerCaseEmail });

    const token = generateAuthToken(newUser._id, newUser.type);

    res.send({
      success: true,
      message: "Account created successfully",
      token: token,
      user: newUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/verify-otp/forget-password", passwordauth, async (req, res) => {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user._id);

    if (!user)
      return res
        .status(400)
        .send({
          success: false,
          message: "The User with the given ID was not found.",
        });

    if (Number(user.code) !== Number(code))
      return res
        .status(400)
        .send({ success: false, message: "Incorrect code." });

    return res.json({
      success: true,
      message: "Verification code match successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/check-email", async (req, res) => {
  const { error } = emailApiBodyValidate(req.body);
  if (error)
    return res
      .status(400)
      .send({ success: false, message: error.details[0].message });

  const { email } = req.body;
  const lowerCaseEmail = String(email).trim().toLocaleLowerCase();

  const user = await User.findOne({ email: lowerCaseEmail });
  if (user)
    return res
      .status(400)
      .send({ success: false, message: "Email already existed" });

  res.send({ success: true, message: "Email doesn't existed" });
});

router.put("/update-user", auth, async (req, res) => {
  const {
    name,image,age,weight,gender,height 
  } = req.body;

  // Create an object to store the fields to be updated
  const updateFields = Object.fromEntries(
    Object.entries({
      name,image,age,weight,gender,height 
    }).filter(([key, value]) => value !== undefined)
  );

  // Check if there are any fields to update
  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .send({
        success: false,
        message: "No valid fields provided for update.",
      });
  }
  const user = await User.findByIdAndUpdate(req.user._id, updateFields, {
    new: true,
  });

  if (!user)
    return res
      .status(400)
      .send({
        success: false,
        message: "The User with the given ID was not found.",
      });

  res.send({ success: true, message: "User updated successfully", user });
});

router.delete("/", auth, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { status: "deleted" },
    { new: true }
  );

  if (!user)
    return res
      .status(400)
      .send({
        success: false,
        message: "The User with the given ID was not found.",
      });

  res.send({ success: true, message: "User deleted successfully", user });
});

module.exports = router;
