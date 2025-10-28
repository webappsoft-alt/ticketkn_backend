const mongoose = require("mongoose");
const ticketObj = {
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
};
const PrintTicket = mongoose.model("PrintTicket", ticketObj);
const adminTicketSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  tickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "PrintTicket",
  }],
  totalTicket: {
    type: Number,
    default: 0,
  },
});

const AdminTicket = mongoose.model("AdminTicket", adminTicketSchema);

module.exports = { AdminTicket, PrintTicket };
