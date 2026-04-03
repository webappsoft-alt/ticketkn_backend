const mongoose = require("mongoose");

const printTicketSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "general",
      enum: ["general", "vip", "vvip", "earlybird"],
    },
    code: {
      type: String,
      unique: true,
    },
    scanned: {
      type: Boolean,
      default: false,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const PrintTicket = mongoose.model("PrintTicket", printTicketSchema);

const adminTicketSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    tickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PrintTicket",
      },
    ],
    totalTicket: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const AdminTicket = mongoose.model("AdminTicket", adminTicketSchema);

module.exports = { AdminTicket, PrintTicket };
