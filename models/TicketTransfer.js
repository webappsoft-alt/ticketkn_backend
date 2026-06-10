const mongoose = require("mongoose");

const ticketTransferSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
    },
    code: {
      type: Number,
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    // To know when the action was taken
    actionAt: Date,
  },
  { timestamps: true },
);

// Prevent duplicate pending transfers for the same ticket code
ticketTransferSchema.index(
  { code: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
const TicketTransfer = mongoose.model("TicketTransfer", ticketTransferSchema);

exports.TicketTransfer = TicketTransfer;
