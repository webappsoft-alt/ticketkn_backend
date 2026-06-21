const mongoose = require("mongoose");
const IntelligenceReport = require("../models/IntelligenceReport");
const Event = require("../models/Event");
const { User } = require("../models/user");

const ACTIVE_STATUSES = ["pending", "delivered"];

function formatReport(report) {
  if (!report) return null;
  const doc = report.toObject ? report.toObject() : report;
  return {
    _id: doc._id,
    eventId: doc.eventId,
    status: doc.status,
    requestedAt: doc.requestedAt,
    deliveredAt: doc.deliveredAt ?? null,
    cancelledAt: doc.cancelledAt ?? null,
    adminNote: doc.adminNote ?? "",
  };
}

function parseRequestedAt(value) {
  if (value == null) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

exports.createRequest = async (req, res) => {
  try {
    const { eventId, requestedAt, event, supplier } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Valid eventId is required." });
    }

    const supplierId = req.user._id;
    const ownedEvent = await Event.findOne({
      _id: eventId,
      user: supplierId,
    }).lean();

    if (!ownedEvent) {
      return res
        .status(403)
        .json({ message: "You do not own this event or it was not found." });
    }

    const existingActive = await IntelligenceReport.findOne({
      eventId,
      supplierId,
      status: { $in: ACTIVE_STATUSES },
    });

    if (existingActive) {
      return res.status(409).json({
        message: "An active intelligence report request already exists for this event.",
        report: formatReport(existingActive),
      });
    }

    let supplierSnapshot = supplier ?? null;
    if (!supplierSnapshot) {
      const supplierDoc = await User.findById(supplierId)
        .select("name email image type")
        .lean();
      if (supplierDoc) {
        supplierSnapshot = {
          _id: supplierDoc._id,
          name: supplierDoc.name,
          email: supplierDoc.email,
          image: supplierDoc.image,
          role: supplierDoc.type,
        };
      }
    }

    const eventSnapshot =
      event ??
      ({
        _id: ownedEvent._id,
        name: ownedEvent.name,
        type: ownedEvent.event_type,
        start_Date: ownedEvent.start_Date,
        start_Time: ownedEvent.start_Time,
        address: ownedEvent.address,
        description: ownedEvent.description,
        category: ownedEvent.category,
        join_people: ownedEvent.join_people,
      });

    const report = await IntelligenceReport.create({
      eventId,
      supplierId,
      status: "pending",
      requestedAt: parseRequestedAt(requestedAt),
      eventSnapshot,
      supplierSnapshot,
    });

    res.status(201).json({
      message: "Intelligence report request submitted successfully.",
      report: formatReport(report),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReportByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Valid eventId is required." });
    }

    const report = await IntelligenceReport.findOne({
      eventId,
      supplierId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!report) {
      return res
        .status(404)
        .json({ message: "No intelligence report found for this event." });
    }

    res.status(200).json({
      report: formatReport(report),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminListReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) > 0 ? parseInt(req.query.page, 10) : 1;
    const limit =
      parseInt(req.query.limit, 10) > 0 ? parseInt(req.query.limit, 10) : 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      const status = String(req.query.status).toLowerCase();
      if (!["pending", "delivered", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status filter." });
      }
      filter.status = status;
    }
    if (req.query.eventId && mongoose.Types.ObjectId.isValid(req.query.eventId)) {
      filter.eventId = req.query.eventId;
    }
    if (
      req.query.supplierId &&
      mongoose.Types.ObjectId.isValid(req.query.supplierId)
    ) {
      filter.supplierId = req.query.supplierId;
    }

    const [reports, total] = await Promise.all([
      IntelligenceReport.find(filter)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IntelligenceReport.countDocuments(filter),
    ]);

    res.status(200).json({
      reports: reports.map((report) => ({
        ...formatReport(report),
        eventSnapshot: report.eventSnapshot ?? null,
        supplierSnapshot: report.supplierSnapshot ?? null,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + reports.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.adminUpdateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "Valid reportId is required." });
    }

    const report = await IntelligenceReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Intelligence report not found." });
    }

    const updates = {};

    if (adminNote !== undefined) {
      updates.adminNote = String(adminNote);
    }

    if (status !== undefined) {
      const nextStatus = String(status).toLowerCase();
      if (!["pending", "delivered", "cancelled"].includes(nextStatus)) {
        return res.status(400).json({
          message: 'status must be "pending", "delivered", or "cancelled".',
        });
      }

      updates.status = nextStatus;

      if (nextStatus === "delivered") {
        updates.deliveredAt = new Date();
      } else if (nextStatus === "cancelled") {
        updates.cancelledAt = new Date();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update." });
    }

    const updated = await IntelligenceReport.findByIdAndUpdate(
      reportId,
      { $set: updates },
      { new: true },
    );

    res.status(200).json({
      message: "Intelligence report updated successfully.",
      report: {
        ...formatReport(updated),
        eventSnapshot: updated.eventSnapshot ?? null,
        supplierSnapshot: updated.supplierSnapshot ?? null,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
