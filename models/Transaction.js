const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  purchased_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
  },
  total_price: {
    type: Number,
    default: 0,
  },
  commission: {
    type: Number,
    default: 0,
  },
  originalPrice: {
    type: Number,
    default: 0,
  },
  type: {
    type: String,
    default: "deposit",
    enum: ["deposit", "purchase"],
  },
  reason: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
