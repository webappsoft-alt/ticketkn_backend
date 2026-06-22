const mongoose = require("mongoose");

const intelligenceReportSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: "",
    },
    eventSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    supplierSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    adminSeen: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

intelligenceReportSchema.index({ supplierId: 1, eventId: 1, status: 1 });
intelligenceReportSchema.index({ adminSeen: 1, requestedAt: -1 });

module.exports = mongoose.model(
  "IntelligenceReport",
  intelligenceReportSchema,
);
