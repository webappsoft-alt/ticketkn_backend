const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },

    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
const supportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  name: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
  msg: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updated_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
  attended: {
    type: Boolean,
    default: false,
  },
  isResolved: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Support", supportSchema);
