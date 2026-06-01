const { name } = require("ejs");
const Support = require("../models/Support");
const { sendNotification } = require("./notificationCreateService");
const { User } = require("../models/user");
exports.create = async (req, res) => {
  try {
    const { name, email, msg, title } = req.body;
    const userId = req.user._id;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "user is not valid" });
    const support = await Support.findOneAndUpdate(
      { user: userId, title: title, isResolved: false },
      {
        $set: { name, email, attended: false, isResolved: false },
        $push: {
          msg: {
            message: msg,
            sender: "user",
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    const user = await User.findOne({ type: "admin" })
      .select("fcmtoken _id")
      .lean();
    await sendNotification({
      user: userId,
      to_id: user._id,
      description: msg,
      type: "support",
      title: `Support message from user`,
      fcmtoken: user?.fcmtoken,
      support: support._id.toString(),
    });
    res.status(201).json({
      success: true,
      message: "Message has sent successfully",
      message: support,
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAdminnotificationsCount = async (req, res) => {
  try {
    const unRead = await Support.countDocuments({
      attended: false,
    });
    const resolved = await Support.countDocuments({
      isResolved: false,
    });
    res.status(200).json({
      success: true,
      unattended: unRead,
      unresolved: resolved,
      total: resolved + unRead,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getAdminnotifications = async (req, res) => {
  const lastId = parseInt(req.params.id);

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  let query = {};
  if (req.params.search) {
    query.name = { $regex: new RegExp(req.params.search, "i") };
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  try {
    const categories = await Support.find(query)
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Support.find(query);
    const totalPages = Math.ceil(totalCount.length / pageSize);
    const unRead = await Support.countDocuments({
      attended: false,
    });
    if (categories.length > 0) {
      res.status(200).json({
        success: true,
        Messages: categories,
        count: {
          totalPage: totalPages,
          currentPageSize: categories.length,
          unRead: unRead,
        },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more Messages found",
        Messages: categories,
        count: {
          totalPage: totalPages,
          currentPageSize: 0,
          unRead: unRead,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getSpecificUserMessages = async (req, res) => {
  const lastId = parseInt(req.params.id);
  const userId = req.user._id;
  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  let query = {};
  query.user = userId;
  if (req.params.search) {
    query.$or = [
      { title: { $regex: new RegExp(req.params.search, "i") } },
      { name: { $regex: new RegExp(req.params.search, "i") } },
    ];
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  try {
    const categories = await Support.find(query)
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Support.find(query);
    const totalPages = Math.ceil(totalCount.length / pageSize);

    if (categories.length > 0) {
      res.status(200).json({
        success: true,
        Messages: categories,
        count: { totalPage: totalPages, currentPageSize: categories.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more Messages found",
        Messages: categories,
        count: { totalPage: totalPages, currentPageSize: 0 },
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.attendTheSupport = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user._id;
    const { msg, isResolved = false } = req.body;

    const service = await Support.findOneAndUpdate(
      { _id: serviceId },
      {
        attended: true,
        updated_at: Date.now(),
        $push: {
          msg: {
            message: msg,
            sender: "admin",
          },
        },
        isResolved: isResolved,
      },
      { new: true },
    ).populate("user");

    if (service == null) {
      return res.status(404).json({ message: "Support not found" });
    }

    await sendNotification({
      user: userId,
      to_id: service.user._id,
      description: msg,
      type: "support",
      title: `Support message from admin`,
      fcmtoken: service.user.fcmtoken,
      support: service._id.toString(),
    });

    res
      .status(200)
      .json({ message: `Support updated successfully`, service: service });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
