const mongoose = require("mongoose");

const subUserSchema = new mongoose.Schema(
  {
    mainUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    fullName: String,
    email: {
      type: String,
      trim: true,
      unique: true,
      required: true,
    },
    phone: String,
    password: String,
    status: {
      type: String,
      default: "active",
      enum: ["active", "inactive", "deleted"],
    },
  },
  { timestamps: true },
);

const subUser = mongoose.model("subUser", subUserSchema);
exports.subUser = subUser;
