const { default: axios } = require("axios");
const Post = require("../models/Event");
const like = require("../models/like");
const Purchase = require("../models/Purchase");
const Resell = require("../models/Resell");
const { sendNotification } = require("./notificationCreateService");
const { User } = require("../models/user");
const admin = require("firebase-admin");
const Coupon = require("../models/Coupon");
const Category = require("../models/Category");
const { ticketCode, generateRandomString } = require("./generateCode");
const { purchaseEmail } = require("./emailservice");
const { AdminTicket, PrintTicket } = require("../models/AdminTicket");
const mongoose = require("mongoose");
const { TicketTransfer } = require("../models/TicketTransfer");
const Notification = require("../models/Notification");
const {
  buildScanActorInfo,
  enrichPurchaseScanInfo,
  enrichPrintTicketScanInfo,
} = require("../utils/scanHelpers");
exports.createPost = async (req, res) => {
  try {
    const {
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      category,
      type,
      location,
      supplierid,
    } = req.body;
    const userId = supplierid || req.user._id;

    const post = new Post({
      user: userId,
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      category,
      tickets_sale: [
        { type: "general", totalTicket: 0 },
        { type: "vip", totalTicket: 0 },
        { type: "vvip", totalTicket: 0 },
        { type: "earlybird", totalTicket: 0 },
      ],
      type,
      location,
    });

    const users = await User.find({ type: "customer", status: "online" })
      .select("fcmtoken")
      .lean();
    const cat = await Category.findById(category).select("name").lean();

    const fcmTokens = [
      ...new Set(
        users
          .map((item) => item.fcmtoken)
          .filter((item) => item !== undefined || item !== ""),
      ),
    ];
    if (fcmTokens.length > 0) {
      // Create an array of message objects for each token
      const messages = fcmTokens.map((token) => ({
        token: token,
        notification: {
          title: "New Event",
          body: `A new Event "${name}" has been created in ${cat.name} area.`,
        },
        android: {
          notification: {
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
      }));
      try {
        await admin.messaging().sendEach(messages);
      } catch (error) {}
    }

    await post.save();
    res
      .status(201)
      .json({ success: true, message: "Event created successfully", post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.editPost = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      location,
      type,
    } = req.body;
    const postId = req.params.id;

    // Create an object to store the fields to be updated
    let updateFields = Object.fromEntries(
      Object.entries({
        images,
        name,
        event_type,
        start_Date,
        start_Time,
        address,
        country,
        city,
        state,
        description,
        join_people,
        ticket_plans,
        refund_policy,
        location,
        type,
      }).filter(([key, value]) => value !== undefined),
    );

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).send({
        success: false,
        message: "No valid fields provided for update.",
      });
    }
    const post = await Post.findOneAndUpdate({ _id: postId }, updateFields, {
      new: true,
    })
      .populate("category")
      .lean();

    if (!post)
      return res.status(404).send({
        success: false,
        message: "The Event with the given ID was not found.",
      });

    res.send({
      success: true,
      message: "Event updated successfully",
      post: post,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.makePopularEvent = async (req, res) => {
  try {
    const { popular } = req.body;
    const postId = req.params.id;

    // Create an object to store the fields to be updated
    let updateFields = Object.fromEntries(
      Object.entries({
        popular,
      }).filter(([key, value]) => value !== undefined),
    );

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).send({
        success: false,
        message: "No valid fields provided for update.",
      });
    }
    const post = await Post.findOneAndUpdate({ _id: postId }, updateFields, {
      new: true,
    });

    if (!post)
      return res.status(404).send({
        success: false,
        message: "The Event with the given ID was not found.",
      });

    res.send({
      success: true,
      message: "Event updated successfully",
      post: post,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getMyPosts = async (req, res) => {
  const lastId = parseInt(req.params.id) || 1;
  const userId = req?.user?._id || "";
  const search = req.params.search?.trim();
  const type = req.query.type?.trim();
  const planType = req.query.plan_type?.trim();
  const ticketType = req.query.ticket_type?.trim();
  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  let query = {};
  query.status = "active";
  query.user = userId;
  // console.log(type);
  if (type) {
    query.type = type;
  }
  if (planType) {
    query["ticketPlanObj.type"] = planType;
  }
  if (ticketType) {
    query["ticketObj.type"] = planType;
  }

  if (search) {
    const regex = new RegExp(search, "i"); // case-insensitive

    query.$or = [
      { name: regex },
      { description: regex },
      { address: regex },
      { city: regex },
      { state: regex },
      { country: regex },
    ];
  }
  const users = await Post.find(query)
    .populate("user")
    .populate("likes")
    .populate({
      path: "purchase_by",
      populate: [
        { path: "user", model: "user" },
        { path: "resel_by", model: "user" },
        {
          path: "resellpurchases",
          model: "Purchase",
          populate: [{ path: "user", model: "user" }],
        },
      ],
    })
    .populate("coupon")
    .populate("category")
    .sort({ start_Date: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0;
    posts.likes =
      Array.isArray(posts.likes) &&
      posts.likes.some((like) => like.user.toString() === userId.toString());
  }

  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);

  res.send({
    success: true,
    posts: users,
    count: { totalPage: totalPages, currentPageSize: users.length },
  });
};

exports.updatePurchasePaymentByAdmin = async (req, res) => {
  try {
    const postId = req.params.id;

    const { paymentDone, payment } = req.body;
    const payemntObject = { amount: payment, date: Date.now() };
    const paidDate = new Date();

    const post = await Post.findOneAndUpdate(
      { _id: postId },
      {
        $set: {
          paymentDone,
          paidDate,
        },
        $push: { payment: payemntObject },
      },
      { new: true },
    );

    if (!post)
      return res.status(404).send({
        success: false,
        message: "The Purchase with the given ID was not found.",
      });

    res.send({
      success: true,
      message: "Purchase payed successfully",
      purchase: post,
      paidDate: post.paidDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAdminPurchases = async (req, res) => {
  const users = await Purchase.find({
    event: req.params.id,
    resel_by: { $exists: false },
  })
    .sort({ _id: -1 })
    .lean();
  const totalPurchase = await Purchase.find({
    event: req.params.id,
    resel_by: { $exists: true },
  })
    .sort({ _id: -1 })
    .lean();

  const totalPayments = users.reduce((a, b) => a + Number(b.totalPrice), 0);
  const totalOtherPayments = totalPurchase.reduce(
    (a, b) => a + Number(b.totalPrice),
    0,
  );
  const totalOwnerTax = users.reduce((a, b) => a + Number(b.ownerPrice), 0);

  const eightPerc = Number(totalPayments) * 0.08;
  // const twoPerc = Number(totalPayments) * 0.02
  const twentPerc = Number(totalOtherPayments) * 0.2;
  const eightResel = Number(totalOtherPayments) * 0.08;

  res.send({
    success: true,
    totalPayments,
    totalOwnerTax,
    adminEarning: eightPerc + twentPerc + eightResel,
  });
};

exports.latestEvent = async (req, res) => {
  const userId = req?.user?._id || "";

  let query = {};
  query.status = "active";
  query.user = userId;

  // Get the current date and time (now)
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Only retrieve upcoming events (those with start_Date in the future)
  query.start_Date = { $gte: startOfDay };

  const users = await Post.find(query)
    .populate("user")
    .populate("likes")
    .populate({
      path: "purchase_by",
      populate: [
        { path: "user", model: "user" },
        { path: "resel_by", model: "user" },
        {
          path: "resellpurchases",
          model: "Purchase",
          populate: [{ path: "user", model: "user" }],
        },
      ],
    })
    .populate("coupon")
    .populate("category")
    .sort({ start_Date: 1 })
    .limit(10)
    .lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0;
    // console.log(posts.likes);
    posts.likes =
      Array.isArray(posts.likes) &&
      posts.likes.some((like) => like.user?.toString() === userId?.toString());
  }

  res.send({ success: true, posts: users });
};

function resolveEventPaidDate(post) {
  if (post?.paidDate) {
    return post.paidDate;
  }
  const payments = Array.isArray(post?.payment) ? post.payment : [];
  if (payments.length === 0) {
    return null;
  }
  const lastPayment = payments[payments.length - 1];
  return lastPayment?.date ?? null;
}

exports.getAdminPost = async (req, res) => {
  const lastId = parseInt(req.params.id) || 1;
  const userId = req.query?.user_id;
  // console.log(req.query);
  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  let query = {};
  query.status = "active";
  if (userId) {
    query.user = new mongoose.Types.ObjectId(userId);
  }
  if (req.params.type !== "all") {
    query.category = req.params.type;
  }

  if (req.body.search) {
    query.name = { $regex: new RegExp(req.body.search, "i") };
  }

  if (req.body.today == "false" || req.body.today == false) {
    // Get the current date and time (now)
    const now = new Date();

    // Only retrieve upcoming events (those with start_Date in the future)
    query.start_Date = { $lte: now };
  }

  if (req.body.today == "true" || req.body.today == true) {
    // Get the current date and time (now)
    const now = new Date();

    // Only retrieve upcoming events (those with start_Date in the future)
    query.start_Date = { $gte: now };
  }
  if (req.body.paymentDone) {
    query.paymentDone =
      req.body.paymentDone == "true" || req.body.paymentDone == true
        ? true
        : false;
  }

  const users = await Post.find(query)
    .populate("user")
    .populate({
      path: "purchase_by",
      // options: { limit: 300 }, // Limit to 3 users
      populate: [
        { path: "user", model: "user" },
        {
          path: "resellpurchases",
          model: "Purchase",
          populate: { path: "user", model: "user" },
        },
      ],
    })
    .populate("category")
    .populate("coupon")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean();

  for (let post of users) {
    // ── Regular purchases (no resel_by) ──────────────────────────────────────
    const purchases = await Purchase.find({
      event: post._id,
      resel_by: { $exists: false },
    })
      .select("totalPrice createdAt")
      .lean();

    const totalPayments = purchases.reduce(
      (a, b) => a + Number(b.totalPrice),
      0,
    );
    post.totalPayments = totalPayments;
    post.paidAmount = (post.payment || []).reduce(
      (a, b) => a + Number(b.amount),
      0,
    );
    post.paidDate = resolveEventPaidDate(post);

    post.ResellTicketsCount = await Resell.countDocuments({
      event: post._id,
      resellTickets: { $exists: false },
    });

    // ── Resell purchases (resel_by exists) ───────────────────────────────────
    const resellPurchases = await Purchase.find({
      event: post._id,
      resel_by: { $exists: true },
    })
      .select("totalPrice createdAt")
      .lean();

    // ── Helper: format a Date as "June 1st, 2026 - 10am" ────────────────────
    const formatEntry = (date) => {
      const d = new Date(date);
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const day = d.getDate();
      const suffix =
        day % 10 === 1 && day !== 11
          ? "st"
          : day % 10 === 2 && day !== 12
            ? "nd"
            : day % 10 === 3 && day !== 13
              ? "rd"
              : "th";
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const hours = d.getHours();
      const ampm = hours >= 12 ? "pm" : "am";
      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      return `${month} ${day}${suffix}, ${year} - ${hour12}${ampm}`;
    };

    // ── Build ledger entries ──────────────────────────────────────────────────
    // Regular purchase: admin earns 8% of gross buyer price.
    // Stored totalPrice = gross * 0.92, so gross = totalPrice / 0.92
    const regularEntries = purchases.map((p) => {
      const gross = Number(p.totalPrice) / 0.92;
      const adminCommission = gross * 0.08;
      return {
        _id: p._id,
        date: formatEntry(p.createdAt),
        type: "ticket sale",
        amount: parseFloat(adminCommission.toFixed(2)),
        rawDate: p.createdAt,
      };
    });

    // Resell purchase: admin earns 20% of the resell price (stored as totalPrice).
    const resellEntries = resellPurchases.map((p) => {
      const adminCommission = Number(p.totalPrice) * 0.2;
      return {
        _id: p._id,
        date: formatEntry(p.createdAt),
        type: "resell ticket",
        amount: parseFloat(adminCommission.toFixed(2)),
        rawDate: p.createdAt,
      };
    });

    // ── Merge, sort chronologically, compute total ────────────────────────────
    const allEntries = [...regularEntries, ...resellEntries].sort(
      (a, b) => new Date(a.rawDate) - new Date(b.rawDate),
    );

    const totalAdminEarnings = parseFloat(
      allEntries.reduce((sum, e) => sum + e.amount, 0).toFixed(2),
    );

    // Remove rawDate before sending (used only for sorting)
    const ledger = allEntries.map(({ _id, date, type, amount }) => ({
      _id,
      date,
      type,
      amount,
      label: `${date} - ${type} - $${amount}`,
    }));

    post.adminEarningsLedger = ledger;
    post.totalAdminEarnings = totalAdminEarnings;
  }

  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);

  res.send({
    success: true,
    posts: users,
    count: { totalPage: totalPages, currentPageSize: users.length },
  });
};

exports.noCouponEvent = async (req, res) => {
  const userId = req?.user?._id || "";
  let query = {};
  // Get the current date and time (now)
  const now = new Date();

  // Only retrieve upcoming events (those with start_Date in the future)
  query.start_Date = { $gte: now };
  query.status = "active";
  query.coupon = null;
  query.user = userId;

  const users = await Post.find(query)
    .populate("user")
    .populate({
      path: "purchase_by",
      options: { limit: 3 }, // Limit to 3 users
      populate: [{ path: "user", model: "user" }],
    })
    .populate("category")
    .sort({ _id: -1 })
    .limit(15)
    .lean();

  res.send({ success: true, posts: users });
};

exports.filterPosts = async (req, res) => {
  const lastId = parseInt(req.body.last_id) || 1;
  const userId = req?.user?._id || "";

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  let query = {};

  query.status = "active";

  if (req.body.search) {
    query.name = { $regex: new RegExp(req.body.search, "i") };
  }

  let sort = { _id: -1 };

  if (req.body.today == "true" || req.body.today == true) {
    // Get the current date and time (now)
    const now = new Date();

    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    // Only retrieve upcoming events (those with start_Date in the future)
    query.start_Date = { $gte: startOfDay };
    sort = { start_Date: 1 };
  }

  if (req.body.otherId) {
    query.user = req.body.otherId;
  }
  if (req.body.category) {
    query.category = req.body.category;
  }
  if (req.body.offer == true) {
    const offerQuery = {
      ...query,
      coupon: { $ne: null }, // Filter only posts with a coupon
    };
    const users = await Post.find(offerQuery)
      .sort({ start_Date: 1 })
      .populate("user")
      .populate("likes")
      .populate("coupon")
      .populate("category")
      .skip(skip)
      .limit(pageSize)
      .lean();
    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0;
      post.likes = userId
        ? Array.isArray(post.likes) &&
          post.likes.some((like) => like.user.toString() === userId.toString())
        : false;
      post.purchase_by = userId
        ? Array.isArray(post.purchase_by) &&
          post.purchase_by.some((like) => like.toString() === userId.toString())
        : false;
    }

    const totalCount = await Post.countDocuments(offerQuery);
    const totalPages = Math.ceil(totalCount / pageSize);

    return res.send({
      success: true,
      posts: users,
      count: { totalPage: totalPages, currentPageSize: users.length },
    });
  }
  if (req.body.address) {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res
        .status(404)
        .send({ message: "Latitude and Longitude are required", posts: [] });
    }

    const radiusInMiles = 20;
    const radiusInMeters = radiusInMiles * 1609.34; // Convert miles to meters

    const users = await Post.find({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusInMeters,
        },
      },
    })
      .sort({ start_Date: 1 })
      .populate("user")
      .populate("likes")
      .populate("coupon")
      .populate("category")
      .skip(skip)
      .limit(pageSize)
      .lean();

    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0;
      post.likes = userId
        ? Array.isArray(post.likes) &&
          post.likes.some((like) => like.user.toString() === userId.toString())
        : false;
      post.purchase_by = userId
        ? Array.isArray(post.purchase_by) &&
          post.purchase_by.some((like) => like.toString() === userId.toString())
        : false;
    }

    const totalCount = await Post.countDocuments({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusInMeters,
        },
      },
    });
    const totalPages = Math.ceil(totalCount / pageSize);

    res.send({
      success: true,
      posts: users,
      count: { totalPage: totalPages, currentPageSize: users.length },
    });
  } else if (req.body.popular) {
    const popularEvents = await Post.find({ ...query, popular: true })
      .populate({
        path: "purchase_by",
        options: { limit: 3 }, // Limit to 3 users
        populate: [{ path: "user", model: "user" }],
      })
      .populate("user")
      .populate("likes")
      .populate("coupon")
      .populate("category")
      .sort({ total_tickets_sale: -1 })
      .limit(pageSize)
      .lean();

    // const users = await Post.find(query).populate({
    //   path: 'purchase_by',
    //   options: { limit: 3 }, // Limit to 3 users
    //   populate: [
    //     { path: 'user', model: 'user' },
    //   ]
    // }).populate("user").populate("likes").populate("coupon").populate("category").sort({ total_tickets_sale: -1 }).limit(pageSize-popularEvents.length).lean();

    for (const post of popularEvents) {
      post.TotalLikes = post?.likes?.length || 0;
      post.likes = userId
        ? Array.isArray(post.likes) &&
          post.likes.some((like) => like.user.toString() === userId.toString())
        : false;
    }

    return res.send({ success: true, posts: popularEvents });
  }
  {
    const users = await Post.find(query)
      .populate({
        path: "purchase_by",
        options: { limit: 3 }, // Limit to 3 users
        populate: [{ path: "user", model: "user" }],
      })
      .populate("user")
      .populate("likes")
      .populate("coupon")
      .populate("category")
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean();
    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0;
      post.likes = userId
        ? Array.isArray(post.likes) &&
          post.likes.some((like) => like.user.toString() === userId.toString())
        : false;
    }

    const totalCount = await Post.find(query);
    const totalPages = Math.ceil(totalCount.length / pageSize);

    res.send({
      success: true,
      posts: users,
      count: { totalPage: totalPages, currentPageSize: users.length },
    });
  }
};

exports.getDetailsEvent = async (req, res) => {
  const userId = req?.user?._id || "";
  const postId = req?.params?.id || "";

  const post = await Post.findById(postId)
    .populate({
      path: "purchase_by",
      options: { limit: 3 }, // Limit to 3 users
      populate: [{ path: "user", model: "user" }],
    })
    .populate("user")
    .populate("likes")
    .populate("coupon")
    .populate("category")
    .lean();

  if (!post) {
    return res.status(404).json({ message: "Event not found." });
  }

  const TotalLikes = post?.likes?.length || 0;
  const likes = userId
    ? Array.isArray(post.likes) &&
      post.likes.some((like) => like.user.toString() === userId.toString())
    : false;

  res.send({ success: true, post: { ...post, TotalLikes, likes } });
};

exports.deletePostById = async (req, res) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findById(postId);

    if (!deletedPost) {
      return res.status(404).json({
        message:
          "Event not found or user does not have permission to delete it",
      });
    }

    // const findPurcahse = await Purchase.findOne({ event: postId });

    // if (findPurcahse)
    //   return res.status(404).json({
    //     message:
    //       "Event cann't deleted as someone has purchased a ticket of it.",
    //   });

    deletedPost.status = "deleted";
    await deletedPost.save();

    await like.deleteMany({ event: postId });
    await AdminTicket.deleteMany({ event: postId });
    await PrintTicket.deleteMany({ event: postId });

    res
      .status(200)
      .json({ message: "Event deleted successfully", post: deletedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const existingLike = await like.findOne({ user: userId, event: postId });

    if (existingLike) {
      return await dislike(postId, res, userId);
    }
    const likePost = new like({
      user: userId,
      event: postId,
    });

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $push: { likes: likePost._id } },
      { new: true },
    ).populate("user");

    if (!updatedPost) {
      return res.status(404).json({ message: "Event not found" });
    }

    await likePost.save();

    res
      .status(200)
      .json({ message: "Like added successfully", post: updatedPost });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const dislike = async (postId, res, userId) => {
  try {
    const deletedLike = await like.findOneAndDelete({
      event: postId,
      user: userId,
    });

    if (!deletedLike) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: deletedLike._id } },
      { new: true },
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Event not found" });
    }

    res
      .status(200)
      .json({ message: "Like deleted successfully", post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMyFavPosts = async (req, res) => {
  const userId = req.user._id;
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }
  let query = {};

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;

  query.user = userId;
  try {
    const likedJobs = await like
      .find(query)
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await like.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const jobs = likedJobs.map((like) => like.event);
    if (jobs.length > 0) {
      const UpdateFav = jobs.map((order) => {
        return {
          ...order, // Spread operator to copy existing properties
          likes: true, // Adding new key with a value
        };
      });
      res.status(200).json({
        success: true,
        posts: UpdateFav,
        count: { totalPage: totalPages, currentPageSize: jobs.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more favorite Events found",
        posts: [],
        count: { totalPage: totalPages, currentPageSize: jobs.length },
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateTicketAndTotal = (tickets_sale, type, count) => {
  const typeSale = tickets_sale;
  let updatedTickets = [...typeSale];
  for (let i = 0; i < updatedTickets.length; i++) {
    if (updatedTickets[i].type === type) {
      updatedTickets[i].totalTicket =
        Number(updatedTickets[i].totalTicket) + Number(count);
    }
  }
  return updatedTickets;
};

function convertToUKFormat(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

exports.purchaseTicket = async (req, res) => {
  const userId = req.user._id;
  const eventId = req.params.id;

  try {
    const {
      totalPrice,
      tickets,
      tickets_type_sale,
      couponId,
      type,
      installmentPlans,
      addOns,
      isinstallment,
    } = req.body;

    const findEvent = await Post.findById(eventId).lean();
    // console.log(findEvent._id)
    if (
      Number(findEvent.total_tickets_sale + Number(tickets)) >
      Number(findEvent.join_people)
    ) {
      return res
        .status(404)
        .json({ message: "Event's tickets are fully sold" });
    }
    // console.log("Hit purchaseTicket")

    const eightPerc = Number(totalPrice) * 0.08;

    const totalPriceValue = Number(totalPrice) - Number(eightPerc);
    const twoPer = Number(totalPriceValue) * 0.02;
    // console.log("Hit purchaseTicket")

    let codeArray = [];

    for (
      let index = 0;
      index < Number(tickets_type_sale[0].totalTicket);
      index++
    ) {
      codeArray.push(ticketCode());
    }
    // console.log("Code", codeArray)

    const post = new Purchase({
      user: userId,
      event: eventId,
      tickets: tickets,
      totalPrice: totalPriceValue,
      ownerPrice: Number(totalPriceValue),
      tickets_type_sale: {
        ...tickets_type_sale[0],
        code: codeArray,
        scanned: [],
      },
      remainig_ticket: tickets,
      type,
      isinstallment,
      installmentPlans,
      addOns,
    });
    // console.log("Event", eventId)

    const event = await Post.findByIdAndUpdate(
      eventId,
      {
        $push: { purchase_by: post._id },
        $inc: {
          total_tickets_sale: Number(tickets),
        },
        $set: {
          tickets_sale: updateTicketAndTotal(
            findEvent.tickets_sale,
            tickets_type_sale[0].type,
            Number(tickets),
          ),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("user category")
      .lean();

    if (!event) return res.status(404).json({ message: "Event not found." });

    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId, {
        $addToSet: { used_by: userId },
      }).lean();
    }

    await sendNotification({
      user: userId,
      to_id: event.user._id,
      description: `Someone has purchased ${tickets} tickets of your ${event.name}`,
      type: "purchase",
      title: "New Ticket Purchase",
      fcmtoken: event.user?.fcmtoken,
      event: eventId,
      purchase: post._id,
    });

    const logInuser = await User.findById(userId).select("email").lean();

    const ukFormattedDate = convertToUKFormat(event.start_Date);

    await purchaseEmail(
      logInuser.email,
      event.name,
      ukFormattedDate,
      event.category.name,
      tickets_type_sale[0].type,
    );

    await post.save();
    res.status(201).json({
      success: true,
      message: "Ticket purchase successfully",
      ticket: post,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.transferTickets = async (req, res) => {
  const ownerUser = req?.user?._id || "";
  const userId = req.params.userId;
  const purchaseId = req.params.purchaseId;
  const code = req.params.code;
  // console.log("Hit transferTickets");
  try {
    // 1. Validate that the ticket exists and is owned by the sender
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      user: ownerUser,
      "tickets_type_sale.code": code, // code is in the available list
      "tickets_type_sale.scanned": { $ne: code }, // not already scanned
    }).populate("user");

    if (!purchase) {
      return res.status(404).json({
        message: "Ticket not found or already used.",
      });
    }

    // 2. Check that there is no other pending transfer for this exact code
    const existingPending = await TicketTransfer.findOne({
      purchase: purchaseId,
      recipient: userId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(409).json({
        message: "A pending transfer request already exists for this ticket.",
      });
    }

    // 3. Create the pending transfer request
    const transfer = await TicketTransfer.create({
      sender: ownerUser,
      recipient: userId,
      purchase: purchaseId,
      code,
      event: purchase.event,
    });

    // 4. Send notification to recipient (with accept/reject deep‑link or actions)
    const toUser = await User.findById(userId).select("fcmtoken").lean();
    const event = await Post.findById(purchase.event).lean();

    await sendNotification({
      user: ownerUser,
      to_id: userId,
      description: `${purchase.user?.name} wants to transfer 1 ticket of ${event.name} to you.`,
      type: "transfer",
      title: "Ticket Transfer Request",
      fcmtoken: toUser?.fcmtoken,
      event: purchase.event,
      transferId: transfer._id, // include this in data payload
    });

    res.status(201).json({
      success: true,
      message: "Transfer request sent.",
      transfer,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.acceptTransfer = async (req, res) => {
  const transferId = req.params.transferId;
  const userId = req.user._id;
  // console.log("Hit acceptTransfer");
  try {
    const transfer = await TicketTransfer.findOne({
      _id: transferId,
      recipient: userId,
      status: "pending",
    });
    if (!transfer) {
      return res
        .status(404)
        .json({ message: "Transfer request not found or already handled." });
    }
    // 1. Perform the actual ticket transfer atomically
    //    Use a transaction to ensure consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // a) Mark the original ticket code as scanned and remove it from code array
      const originalPurchase = await Purchase.findOneAndUpdate(
        {
          _id: transfer.purchase,
          "tickets_type_sale.code": transfer.code,
          "tickets_type_sale.scanned": { $ne: transfer.code },
        },
        { $addToSet: { "tickets_type_sale.scanned": transfer.code } },
        { new: true, session },
      );

      if (!originalPurchase) {
        throw new Error("Ticket already transferred or invalid.");
      }

      // b) Remove the code from the code array and decrement remaining tickets
      await Purchase.updateOne(
        { _id: transfer.purchase },
        {
          $pull: { "tickets_type_sale.code": transfer.code },
          $inc: { remainig_ticket: -1 },
        },
        { session },
      );

      // c) Create a new purchase for the recipient
      const newPurchase = new Purchase({
        user: transfer.recipient,
        event: transfer.event,
        tickets: 1,
        totalPrice: originalPurchase.totalPrice, // or the single ticket price, adapt as needed
        remainig_ticket: 1,
        tickets_type_sale: {
          type: originalPurchase.tickets_type_sale.type,
          totalTicket: 1,
          price: originalPurchase.tickets_type_sale.price,
          code: ticketCode(), // generate a fresh code
          scanned: [],
        },
        resel_by: transfer.sender,
      });

      await newPurchase.save({ session });

      // d) Update the transfer request status
      transfer.status = "accepted";
      transfer.actionAt = new Date();
      await Notification.findOneAndDelete({
        transferId: transferId,
      }).session(session);
      await transfer.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Notify the sender about the acceptance
      // (Optional, but good for UX)

      res.status(200).json({
        success: true,
        message: "Ticket accepted and transferred.",
        newPurchase,
      });
    } catch (err) {
      console.log(err);
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.rejectTransfer = async (req, res) => {
  const transferId = req.params.transferId;
  const userId = req.user._id;

  try {
    const transfer = await TicketTransfer.findOneAndUpdate(
      {
        _id: transferId,
        recipient: userId,
        status: "pending",
      },
      {
        status: "rejected",
        actionAt: new Date(),
      },
      { new: true },
    ).populate([
      { path: "sender", select: "name fcmtoken" },
      { path: "recipient", select: "name fcmtoken" },
      { path: "event", select: "name" },
    ]);

    if (!transfer) {
      return res
        .status(404)
        .json({ message: "Transfer request not found or already handled." });
    }
    await Notification.findOneAndDelete({
      transferId: transferId,
    });
    // Optionally notify sender of rejection
    await sendNotification({
      user: transfer.recipient._id,
      to_id: transfer.sender._id,
      description: `${transfer.recipient?.name} has rejected your transfer request.`,
      type: "transfer",
      title: "Transfer Request Rejected",
      fcmtoken: transfer.sender?.fcmtoken,
      event: transfer.event._id,
      // transferId: transfer._id,
    });
    res.status(200).json({
      success: true,
      message: "Transfer request rejected.",
      transfer,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.paymentDone = async (req, res) => {
  try {
    const body = {
      live: 0,
      timestamp: "20240726190607",
      refnum: "123123123123",
      jadnumber: "101310573865",
      amount: "277.99",
      cardnumber: "4444111122223333",
      cardexpmonth: "09",
      cardexpyear: "2045",
      cardcvv: "123",
      cardfirstname: "Naee1m",
      cardlastname: "Junejo",
      address: "wqewds ",
      city: "sdssa",
      state: "KNK",
      postalcode: "123123",
      country: "KN",
      email: "alrandw@gmail.com",
      phone: "",
    };
    const clientId = "0FGR7.1720815360";
    const apiSecret =
      "6EF4CAFCD82E689DECA28EDFDE15ADB35D12BF5982B182E468758A9F8DD072DF";

    const response = await axios.get(
      `https://jad.cash/HAPI/token?apikey=${clientId}&secret=${apiSecret}&grant_type=credentials`,
    );
    const result = await axios.post(
      "https://jad.cash/HAPI/cardpayment",
      {
        token: response.data.data.token,
        paydata: body,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    res.status(201).json({ success: true, response: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updatePurchaseScan = async (req, res) => {
  try {
    const ownerUser = req?.mainUser || req?.user?._id || "";
    // console.log("user", req.params.userId);
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const eventId = new mongoose.Types.ObjectId(req.params.eventId);
    const purchaseId = new mongoose.Types.ObjectId(req.params.purchaseId);
    const purchaseCode = req.params.code;

    const scannedAtRaw = req.body?.scannedAt;
    const scannedAt =
      scannedAtRaw != null && !Number.isNaN(new Date(scannedAtRaw).getTime())
        ? new Date(scannedAtRaw)
        : new Date();
    let scannedby = "";
    let subUser = null;
    if (req?.mainUser) {
      scannedby = req.user.fullName;
      subUser = req.user._id;
    } else {
      scannedby = "Owner";
    }

    const codeForLog = Number(purchaseCode);
    const logCode = Number.isNaN(codeForLog) ? purchaseCode : codeForLog;

    const event = await Post.findOne({ _id: eventId, user: ownerUser });

    if (!event) return res.status(404).json({ message: "Event not found." });

    const purchase = await Purchase.findOneAndUpdate(
      {
        user: userId,
        _id: purchaseId,
        "tickets_type_sale.code": { $in: purchaseCode },
        "tickets_type_sale.scanned": { $ne: purchaseCode },
      },
      {
        $addToSet: { "tickets_type_sale.scanned": purchaseCode },
        $push: {
          "tickets_type_sale.scannedAtLog": {
            scannedby: scannedby,
            code: logCode,
            subUser: subUser,
            scannedAt,
          },
        },
      },
      { new: true },
    )
      .populate("ResellTickets")
      .populate("resellpurchases")
      .populate("user")
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            // options: { limit: 3 },
            populate: [
              { path: "user", model: "user" },
              { path: "resel_by", model: "user" },
              {
                path: "resellpurchases",
                model: "Purchase",
                populate: [{ path: "user", model: "user" }],
              },
            ],
          },
        ],
      })
      .populate({
        path: "tickets_type_sale.scannedAtLog.subUser",
        select: "fullName email",
      });

    if (!purchase)
      return res
        .status(404)
        .json({ message: "Ticket did not found or has already been scanned." });

    const enriched = enrichPurchaseScanInfo(purchase);
    const scan = {
      code: logCode,
      scannedAt,
      ...buildScanActorInfo({ scannedby, subUser }),
    };

    res.status(200).json({ success: true, post: enriched, scan });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPurchaseTicket = async (req, res) => {
  try {
    const userId = req.params.userId;
    const purchaseId = req.params.purchaseId;
    const purchaseCode = req.params.code;

    const event = await Purchase.findOne({
      user: userId,
      _id: purchaseId,
      "tickets_type_sale.code": { $in: purchaseCode },
      "tickets_type_sale.scanned": { $ne: purchaseCode },
    })
      .populate("ResellTickets")
      .populate("resellpurchases")
      .populate("user")
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      });

    if (!event)
      return res
        .status(404)
        .json({ message: "Ticket did not found or has already been scanned." });

    if (event.resellticket >= event.tickets)
      return res
        .status(404)
        .json({ message: "You have resell all of your tickets already." });

    res.status(200).json({ success: true, post: event });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPurchaseAdminSide = async (req, res) => {
  const userId = req.query.user_id;
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }
  let query = {};

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  if (userId) {
    // if (!mongoose.Types.ObjectId.isValid(userId)) {
    //   return res.status(400).json({ error: "Invalid user_id" });
    // }
    query.user = new mongoose.Types.ObjectId(userId);
  }
  query.remainig_ticket = { $gt: 0 };
  try {
    const likedJobs = await Purchase.find(query)
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "likes", model: "Like" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      })
      .populate("user")
      .populate("ResellTickets")
      .populate("resellpurchases")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Purchase.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    if (likedJobs.length > 0) {
      // for (let purchase of likedJobs) {
      //   // purchase.event.TotalLikes = purchase.event?.likes?.length;
      //   purchase.event.likes = userId
      //     ? Array.isArray(purchase.event?.likes) &&
      //       purchase.event.likes.some(
      //         (like) => like.user.toString() === userId.toString(),
      //       )
      //     : false;
      // }
      res.status(200).json({
        success: true,
        posts: likedJobs,
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more purchase events found",
        posts: [],
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPurchase = async (req, res) => {
  const userId = req.user._id;
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }
  let query = { event: { $exists: true, $ne: null } };

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  query.user = new mongoose.Types.ObjectId(userId);

  query.remainig_ticket = { $gt: 0 };
  try {
    const likedJobs = await Purchase.aggregate([
      // 1. Initial Query Filter
      { $match: query },

      // 2. Filter out records where Event does not exist in DB
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventCheck",
        },
      },
      { $match: { "eventCheck.0": { $exists: true } } },

      // 3. Sorting & Pagination
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: pageSize },

      // 4. Populate: ResellTickets (Refs Resell model -> resells collection)
      {
        $lookup: {
          from: "resells",
          localField: "ResellTickets",
          foreignField: "_id",
          as: "ResellTickets",
        },
      },
      { $unwind: { path: "$ResellTickets", preserveNullAndEmptyArrays: true } },

      // 5. Populate: resellpurchases (Refs Purchase model -> purchases collection)
      {
        $lookup: {
          from: "purchases",
          localField: "resellpurchases",
          foreignField: "_id",
          as: "resellpurchases",
        },
      },

      // 6. Populate top-level user
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // 7. Populate: event
      { $addFields: { event: { $arrayElemAt: ["$eventCheck", 0] } } },

      // 8. Populate deeply nested fields inside event
      {
        $lookup: {
          from: "users",
          localField: "event.user",
          foreignField: "_id",
          as: "eventUser",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "event.category",
          foreignField: "_id",
          as: "eventCategory",
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "event.likes",
          foreignField: "_id",
          as: "eventLikes",
        },
      },
      {
        $lookup: {
          from: "coupons",
          localField: "event.coupon",
          foreignField: "_id",
          as: "eventCoupon",
        },
      },
      {
        $lookup: {
          from: "purchases",
          localField: "event.purchase_by",
          foreignField: "_id",
          as: "eventPurchases",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "eventPurchases.user",
          foreignField: "_id",
          as: "purchaseUsers",
        },
      },

      // 9. Final Structure Reconstruction
      {
        $addFields: {
          "event.user": { $arrayElemAt: ["$eventUser", 0] },
          "event.category": { $arrayElemAt: ["$eventCategory", 0] },
          "event.TotalLikes": { $size: { $ifNull: ["$eventLikes", []] } },
          "event.likes": {
            $cond: {
              if: {
                $and: [
                  { $ne: [userId, null] },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$eventLikes", []] },
                            as: "l",
                            cond: {
                              $eq: [
                                "$$l.user",
                                new mongoose.Types.ObjectId(userId),
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
              then: true,
              else: false,
            },
          },
          "event.coupon": { $arrayElemAt: ["$eventCoupon", 0] },
          "event.purchase_by": {
            $slice: [
              {
                $map: {
                  input: "$eventPurchases",
                  as: "p",
                  in: {
                    $mergeObjects: [
                      "$$p",
                      {
                        user: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$purchaseUsers",
                                as: "pu",
                                cond: { $eq: ["$$pu._id", "$$p.user"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                    ],
                  },
                },
              },
              3,
            ],
          },
        },
      },

      // 10. Cleanup
      {
        $project: {
          eventCheck: 0,
          eventUser: 0,
          eventCategory: 0,
          eventLikes: 0,
          eventCoupon: 0,
          eventPurchases: 0,
          purchaseUsers: 0,
        },
      },
    ]);

    const totalCount = await Purchase.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    if (likedJobs.length > 0) {
      res.status(200).json({
        success: true,
        posts: likedJobs,
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more purchase events found",
        posts: [],
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.eventsPurchases = async (req, res) => {
  const event = req.params.eventId;
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }
  let query = {};

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  query.event = event;
  if (req.params.status !== "all") {
    query.scanner = Boolean(req.params.status);
  }
  query.remainig_ticket = { $gt: 0 };
  query.resel_by = { $exists: false };

  try {
    const likedJobs = await Purchase.find(query)
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      })
      .populate("user")
      .populate("ResellTickets")
      .populate("resellpurchases")
      .populate({
        path: "tickets_type_sale.scannedAtLog.subUser",
        select: "fullName email",
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const purchases = likedJobs.map((purchase) =>
      enrichPurchaseScanInfo(purchase),
    );

    const totalCount = await Purchase.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);
    if (purchases.length > 0) {
      res.status(200).json({
        success: true,
        purchases,
        count: { totalPage: totalPages, currentPageSize: purchases.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more purchase purchases found",
        purchases: [],
        count: { totalPage: totalPages, currentPageSize: purchases.length },
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMyPurchases = async (req, res) => {
  const userId = req.user._id;
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;

  const events = await Post.find({ user: userId, status: "active" }).select(
    "status",
  );

  const totalEvents = events.map((item) => item._id);

  try {
    const likedJobs = await Purchase.find({
      event: { $in: totalEvents },
      resel_by: { $exists: false },
      remainig_ticket: { $gt: 0 },
    })
      .populate({
        path: "event",
        populate: [
          { path: "user", model: "user" },
          { path: "category", model: "Category" },
          { path: "coupon", model: "Coupon" },
          {
            path: "purchase_by",
            model: "Purchase",
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      })
      .populate("user")
      .populate("ResellTickets")
      .populate("resellpurchases")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Purchase.countDocuments({
      event: { $in: totalEvents },
      resel_by: { $exists: false },
    });
    const totalPages = Math.ceil(totalCount / pageSize);
    if (likedJobs.length > 0) {
      res.status(200).json({
        success: true,
        purchases: likedJobs,
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No more purchase purchases found",
        purchases: [],
        count: { totalPage: totalPages, currentPageSize: likedJobs.length },
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createAdminTicket = async (req, res) => {
  try {
    // console.log("createAdminTicket", req.body);
    const { eventId, tickets, supplierId } = req.body;

    if (
      !eventId ||
      !Array.isArray(tickets) ||
      tickets.length === 0 ||
      !supplierId
    ) {
      return res
        .status(400)
        .json({ message: "eventId, supplierId, and tickets are required" });
    }

    // Validate ticket structure
    for (const ticket of tickets) {
      if (!ticket.type || !ticket.totalTicket || ticket.totalTicket <= 0) {
        return res.status(400).json({
          message:
            "Each ticket must have type and totalTicket (positive number)",
        });
      }
    }

    // Check if event exists
    const event = await Post.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if supplier exists
    const supplier = await User.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Prevent multiple admin tickets for the same event and supplier
    const existingTicket = await AdminTicket.findOne({
      event: eventId,
      supplier: supplierId,
    });
    if (existingTicket) {
      return res.status(400).json({
        message: "Admin ticket already exists for this event and supplier",
        adminTicket: existingTicket,
      });
    }

    let printTickets = [];
    let totalTicketCount = 0;

    for (const ticket of tickets) {
      // Create multiple PrintTickets based on totalTicket count
      for (let i = 0; i < ticket.totalTicket; i++) {
        const code = generateRandomString(8);
        console.log(code);
        const printTicket = await PrintTicket.create({
          type: ticket.type,
          code: code,
          scanned: false,
        });
        printTickets.push(printTicket._id);
        totalTicketCount++;
      }
    }

    // Create AdminTicket
    const adminTicket = await AdminTicket.create({
      event: eventId,
      supplier: supplierId,
      tickets: printTickets,
      totalTicket: totalTicketCount,
    });
    const adminTicketWithTickets = await AdminTicket.findById(adminTicket._id)
      .populate(["tickets", "event", "supplier"])
      .lean();
    res.status(201).json({
      message: "Admin ticket created successfully",
      adminTicket: adminTicketWithTickets,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.updateAdminTicket = async (req, res) => {
  try {
    // console.log("updateAdminTicket", req.body);
    const { tickets } = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({
        message: "tickets array is required and must not be empty",
      });
    }

    // Validate ticket structure
    for (const ticket of tickets) {
      if (!ticket.type || !ticket.totalTicket || ticket.totalTicket <= 0) {
        return res.status(400).json({
          message:
            "Each ticket must have type and totalTicket (positive number)",
        });
      }
    }

    // Check if admin ticket exists
    const existingAdminTicket = await AdminTicket.findById(req.params.id);
    if (!existingAdminTicket) {
      return res.status(404).json({ message: "Admin ticket not found" });
    }

    // Delete existing PrintTickets
    await PrintTicket.deleteMany({ _id: { $in: existingAdminTicket.tickets } });

    let printTickets = [];
    let totalTicketCount = 0;

    for (const ticket of tickets) {
      // Create multiple PrintTickets based on totalTicket count
      for (let i = 0; i < ticket.totalTicket; i++) {
        const code = generateRandomString(8);
        console.log(code);
        const printTicket = await PrintTicket.create({
          type: ticket.type,
          code: code,
          scanned: false,
        });
        printTickets.push(printTicket._id);
        totalTicketCount++;
      }
    }

    // Update AdminTicket
    const adminTicket = await AdminTicket.findByIdAndUpdate(
      req.params.id,
      {
        tickets: printTickets,
        totalTicket: totalTicketCount,
      },
      { new: true, runValidators: true },
    );

    const adminTicketWithTickets = await AdminTicket.findById(adminTicket._id)
      .populate(["tickets", "event", "supplier"])
      .lean();

    res.status(200).json({
      message: "Admin ticket updated successfully",
      adminTicket: adminTicketWithTickets,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

function enrichPurchaseWithScannedAt(purchase) {
  return enrichPurchaseScanInfo(purchase);
}

exports.getAdminTickets = async (req, res) => {
  try {
    const userId = req.query.userId;
    const eventId = req.query.eventId;
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10;
    const skip = (page - 1) * limit;
    const category = req.query.category ? req.query.category.trim() : "";
    const search = req.query.search ? req.query.search.trim() : "";

    // Build base filter for AdminTicket collection
    let baseFilter = {};
    if (userId) {
      baseFilter.supplier = userId;
    }
    if (eventId) {
      baseFilter.event = eventId;
    }

    // If search or category is provided, use aggregation framework for flexible filtering
    let adminTickets, total;
    if (search || category) {
      // Build aggregation pipeline
      const pipeline = [];

      // Add initial match stage for base filters (userId, eventId)
      if (Object.keys(baseFilter).length > 0) {
        pipeline.push({ $match: baseFilter });
      }

      // Lookup event and supplier for search capability
      pipeline.push(
        {
          $lookup: {
            from: "events",
            localField: "event",
            foreignField: "_id",
            as: "event",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "supplier",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: "$event" },
        { $unwind: "$supplier" },
      );

      // Add search filter if provided
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "event.name": { $regex: search, $options: "i" } },
              { "supplier.name": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Lookup tickets to enable category filtering
      pipeline.push({
        $lookup: {
          from: "printtickets",
          localField: "tickets",
          foreignField: "_id",
          as: "tickets",
        },
      });

      // Add category filter if provided
      if (category) {
        pipeline.push({
          $match: {
            "tickets.type": category,
          },
        });
      }

      // Get total count before pagination
      const countPipeline = [...pipeline, { $count: "count" }];
      const countResult = await AdminTicket.aggregate(countPipeline);
      total = countResult.length > 0 ? countResult[0].count : 0;

      // Add pagination stages
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Execute aggregation
      adminTickets = await AdminTicket.aggregate(pipeline);
    } else {
      // No search or category filter - use simple find with filter
      [adminTickets, total] = await Promise.all([
        AdminTicket.find(baseFilter)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .populate(["event", "supplier", "tickets"]),
        AdminTicket.countDocuments(baseFilter),
      ]);
    }

    adminTickets = adminTickets.map((batch) => {
      const b = batch?.toObject ? batch.toObject() : { ...batch };
      return {
        ...b,
        tickets: (b.tickets || []).map((ticket) =>
          enrichPrintTicketScanInfo(ticket),
        ),
      };
    });

    let purchases = [];
    if (eventId && userId) {
      const eventDoc = await Post.findById(eventId).select("user").lean();
      if (eventDoc && String(eventDoc.user) === String(userId)) {
        const purchaseDocs = await Purchase.find({ event: eventId })
          .populate("user", "name email phone")
          .populate({
            path: "tickets_type_sale.scannedAtLog.subUser",
            select: "fullName email",
          })
          .sort({ createdAt: -1 })
          .lean();
        purchases = purchaseDocs.map((doc) => enrichPurchaseScanInfo(doc));
      }
    }

    res.status(200).json({
      message: "Admin tickets fetched successfully",
      adminTickets,
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + adminTickets.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getAdminTicketbyId = async (req, res) => {
  try {
    const adminTicket = await AdminTicket.findById(req.params.id).populate([
      "event",
      "supplier",
      "tickets",
    ]);
    res
      .status(200)
      .json({ message: "Admin ticket fetched successfully", adminTicket });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.deleteAdminTicket = async (req, res) => {
  try {
    const adminTicket = await AdminTicket.findByIdAndDelete(req.params.id);
    await PrintTicket.deleteMany({ _id: { $in: adminTicket.tickets } });
    res.status(200).json({ message: "Admin ticket deleted successfully" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.deletePrintTicket = async (req, res) => {
  try {
    const printTicket = await PrintTicket.findOneAndDelete({
      _id: req.params.id,
      scanned: false,
    });
    if (!printTicket) {
      return res.status(404).json({ message: "Print ticket not found" });
    }
    await AdminTicket.updateOne(
      { tickets: { $in: [printTicket._id] } },
      { $pull: { tickets: printTicket._id } },
    );

    res.status(200).json({ message: "Print ticket deleted successfully" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.scanPrintTicket = async (req, res) => {
  try {
    const supplierId = req?.mainUser || req.user._id;
    const eventId = req.params.eventId;
    const adminTicket = await AdminTicket.findOne({
      supplier: supplierId,
      event: eventId,
      tickets: { $in: [req.params.id] },
    })
      .populate("event")
      .populate({
        path: "event",
        populate: [{ path: "user" }, { path: "purchase_by", populate: "user" }],
      });
    if (!adminTicket) {
      return res.status(404).json({
        success: false,
        message: "Print ticket not found or code is incorrect",
      });
    }
    const printTicket = await PrintTicket.findOne({
      _id: req.params.id,
      code: req.params.code,
    });
    if (!printTicket) {
      return res.status(404).json({
        success: false,
        message: "Print ticket not found or code is incorrect",
      });
    }
    if (printTicket.scanned) {
      return res.status(400).json({
        success: false,
        message: "Print ticket already scanned",
      });
    }
    if (req?.mainUser) {
      printTicket.scannedBy = req.user.fullName;
      printTicket.subUser = req.user._id;
    } else {
      printTicket.scannedBy = "Owner";
      printTicket.subUser = undefined;
    }
    printTicket.scanned = true;
    printTicket.scannedAt = new Date();
    await printTicket.save();

    const populatedPrintTicket = await PrintTicket.findById(printTicket._id)
      .populate("subUser", "fullName email")
      .lean();
    const enrichedPrintTicket = enrichPrintTicketScanInfo(populatedPrintTicket);
    const scan = {
      code: printTicket.code,
      scannedAt: enrichedPrintTicket.scannedAt,
      ...buildScanActorInfo({
        scannedBy: enrichedPrintTicket.scannedBy,
        subUser: enrichedPrintTicket.subUser?._id ?? enrichedPrintTicket.subUser,
      }),
    };

    res.status(200).json({
      success: true,
      message: "Print ticket scanned successfully",
      data: adminTicket,
      printTicket: enrichedPrintTicket,
      scan,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getSupplierEventScans = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Post.findOne({ _id: eventId, user: req.user._id });
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    const purchaseDocs = await Purchase.find({
      event: eventId,
      resel_by: { $exists: false },
      "tickets_type_sale.scannedAtLog.0": { $exists: true },
    })
      .populate("user", "name email phone")
      .populate({
        path: "tickets_type_sale.scannedAtLog.subUser",
        select: "fullName email",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const purchaseScans = [];
    for (const doc of purchaseDocs) {
      const enriched = enrichPurchaseScanInfo(doc);
      const log = enriched.tickets_type_sale?.scannedAtLog || [];
      for (const entry of log) {
        purchaseScans.push({
          ticketType: "purchase",
          eventId,
          purchaseId: doc._id,
          attendee: doc.user,
          code: entry.code,
          scannedAt: entry.scannedAt,
          scannedByType: entry.scannedByType,
          scannedByName: entry.scannedByName,
          subUserId: entry.subUserId,
          subUser: entry.subUser ?? null,
        });
      }
    }
    purchaseScans.sort(
      (a, b) =>
        new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
    );

    const adminBatches = await AdminTicket.find({
      event: eventId,
      supplier: req.user._id,
    })
      .populate({
        path: "tickets",
        match: { scanned: true },
        populate: { path: "subUser", select: "fullName email" },
      })
      .lean();

    const printTicketScans = [];
    for (const batch of adminBatches) {
      for (const ticket of batch.tickets || []) {
        const enriched = enrichPrintTicketScanInfo(ticket);
        printTicketScans.push({
          ticketType: "print",
          eventId,
          printTicketId: enriched._id,
          code: enriched.code,
          ticketCategory: enriched.type,
          scannedAt: enriched.scannedAt,
          scannedByType: enriched.scannedByType,
          scannedByName: enriched.scannedByName,
          subUserId: enriched.subUserId,
          subUser: enriched.subUser ?? null,
        });
      }
    }
    printTicketScans.sort(
      (a, b) =>
        new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
    );

    res.status(200).json({
      success: true,
      purchaseScans,
      printTicketScans,
      total: purchaseScans.length + printTicketScans.length,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.purchaseInstallment = async (req, res) => {
  try {
    const userId = req.user._id;
    const eventId = req.params.id;
    const {
      totalPrice,
      tickets,
      tickets_type_sale,
      couponId,
      type,
      installmentPlans,
      addOns,
    } = req.body;

    const findEvent = await Post.findById(eventId).lean();

    if (
      Number(findEvent.total_tickets_sale + Number(tickets)) >
      Number(findEvent.join_people)
    ) {
      return res
        .status(404)
        .json({ message: "Event's tickets are fully sold" });
    }

    const eightPerc = Number(totalPrice) * 0.08;

    const totalPriceValue = Number(totalPrice) - Number(eightPerc);
    const twoPer = Number(totalPriceValue) * 0.02;

    let codeArray = [];

    for (
      let index = 0;
      index < Number(tickets_type_sale[0].totalTicket);
      index++
    ) {
      codeArray.push(ticketCode());
    }

    const post = new Purchase({
      user: userId,
      event: eventId,
      tickets: tickets,
      totalPrice: totalPriceValue,
      ownerPrice: Number(totalPriceValue),
      tickets_type_sale: {
        ...tickets_type_sale[0],
        code: codeArray,
        scanned: [],
      },
      remainig_ticket: tickets,
      type,
      isinstallment: true,
      addOns,
      installmentPlans,
    });

    const event = await Post.findByIdAndUpdate(
      eventId,
      {
        $addToSet: { purchase_by: post._id },
        total_tickets_sale:
          Number(findEvent.total_tickets_sale) + Number(tickets),
        tickets_sale: updateTicketAndTotal(
          findEvent.tickets_sale,
          tickets_type_sale[0].type,
          Number(tickets),
        ),
      },
      { new: true },
    )
      .populate("user category")
      .lean();

    if (!event) return res.status(404).json({ message: "Event not found." });

    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId, {
        $addToSet: { used_by: userId },
      }).lean();
    }

    await sendNotification({
      user: userId,
      to_id: event.user._id,
      description: `Someone has purchased ${tickets} tickets of your ${event.name} on Installment`,
      type: "purchase",
      title: "New Ticket Purchase",
      fcmtoken: event.user?.fcmtoken,
      event: eventId,
      purchase: post._id,
    });

    const logInuser = await User.findById(userId).select("email").lean();

    const ukFormattedDate = convertToUKFormat(event.start_Date);

    await purchaseEmail(
      logInuser.email,
      event.name,
      ukFormattedDate,
      event.category.name,
      tickets_type_sale[0].type,
    );

    await post.save();
    res.status(201).json({
      success: true,
      message: "Ticket purchase successfully",
      ticket: post,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.payInstallment = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { installmentPlans, isinstallment } = req.body;

    if (!Array.isArray(installmentPlans) || installmentPlans.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "installmentPlans is required" });
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    const user = await User.findById(purchase.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isInstallmentPaid = (plan) =>
      plan?.payment === true ||
      plan?.payment === "true" ||
      plan?.paid === true ||
      plan?.isPaid === true ||
      plan?.paymentDone === true ||
      plan?.status === "paid" ||
      plan?.status === "completed";

    const getInstallmentAmount = (plan) => {
      const amount = Number(plan?.price ?? plan?.amount ?? plan?.total ?? 0);
      return Number.isNaN(amount) ? 0 : amount;
    };

    const grossPaid = installmentPlans.reduce(
      (sum, plan) =>
        sum + (isInstallmentPaid(plan) ? getInstallmentAmount(plan) : 0),
      0,
    );
    const netPaid = Number((grossPaid - grossPaid * 0.08).toFixed(4));
    const allInstallmentsPaid = installmentPlans.every(isInstallmentPaid);

    purchase.installmentPlans = installmentPlans;
    purchase.ownerPrice = netPaid;
    purchase.totalPrice = netPaid;
    purchase.markModified("installmentPlans");

    if (allInstallmentsPaid || isinstallment === false || isinstallment === "false") {
      purchase.isinstallment = false;
      purchase.paymentDone = true;
    } else {
      purchase.isinstallment = true;
    }

    await purchase.save();
    res
      .status(200)
      .json({ success: true, message: "Payment successful", ticket: purchase });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
