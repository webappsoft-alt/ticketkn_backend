const { default: axios } = require("axios");
const Post = require("../models/Event");
const like = require("../models/like");
const Purchase = require("../models/Purchase");
const { sendNotification } = require("./notificationCreateService");
const { User } = require("../models/user");
const admin = require("firebase-admin");
const Coupon = require("../models/Coupon");
const Category = require("../models/Category");
const { ticketCode, generateRandomString } = require("./generateCode");
const { purchaseEmail } = require("./emailservice");
const { AdminTicket, PrintTicket } = require("../models/AdminTicket");
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
          .filter((item) => item !== undefined || item !== "")
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
      }).filter(([key, value]) => value !== undefined)
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

exports.makePopularEvent = async (req, res) => {
  try {
    const { popular } = req.body;
    const postId = req.params.id;

    // Create an object to store the fields to be updated
    let updateFields = Object.fromEntries(
      Object.entries({
        popular,
      }).filter(([key, value]) => value !== undefined)
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
  console.log(type);
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
      // options: { limit: 3 }, // Limit to 3 users
      populate: [{ path: "user", model: "user" }],
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

    const post = await Post.findOneAndUpdate(
      { _id: postId },
      { paymentDone: paymentDone, $push: { payment: payemntObject } },
      { new: true }
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
    0
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
    .populate({
      path: "purchase_by",
      options: { limit: 3 }, // Limit to 3 users
      populate: [{ path: "user", model: "user" }],
    })
    .populate("category")
    .populate("coupon")
    .sort({ start_Date: 1 })
    .limit(10)
    .lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0;
    console.log(posts.likes);
    posts.likes =
      Array.isArray(posts.likes) &&
      posts.likes.some((like) => like.user?.toString() === userId?.toString());
  }

  res.send({ success: true, posts: users });
};

exports.getAdminPost = async (req, res) => {
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: "Invalid last_id" });
  }

  const pageSize = 10;

  const skip = Math.max(0, lastId - 1) * pageSize;
  let query = {};
  query.status = "active";

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
      options: { limit: 3 }, // Limit to 3 users
      populate: [{ path: "user", model: "user" }],
    })
    .populate("category")
    .populate("coupon")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean();

  for (let post of users) {
    const purchases = await Purchase.find({
      event: post._id,
      resel_by: { $exists: false },
    })
      .select("totalPrice")
      .lean();
    const totalPayments = purchases.reduce(
      (a, b) => a + Number(b.totalPrice),
      0
    );
    post.totalPayments = totalPayments;
    post.paidAmount = post.payment.reduce((a, b) => a + Number(b.amount), 0);
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
      now.getDate()
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

    const findPurcahse = await Purchase.findOne({ event: postId });

    if (findPurcahse)
      return res.status(404).json({
        message:
          "Event cann't deleted as someone has purchased a ticket of it.",
      });

    deletedPost.status = "deleted";
    await deletedPost.save();

    await like.deleteMany({ event: postId });

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
      { new: true }
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
      { new: true }
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
      isinstallment,
      installmentPlans,
      addOns,
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
          Number(tickets)
        ),
      },
      { new: true }
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
      tickets_type_sale[0].type
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
  const purchaseCode = req.params.code;

  try {
    const purchase = await Purchase.findOneAndUpdate(
      {
        user: ownerUser,
        _id: purchaseId,
        "tickets_type_sale.code": { $in: purchaseCode },
        "tickets_type_sale.scanned": { $ne: purchaseCode },
      },
      { $addToSet: { "tickets_type_sale.scanned": purchaseCode } },
      { new: true }
    ).populate("user");

    if (!purchase)
      return res
        .status(404)
        .json({ message: "Ticket did not found or has already been scanned." });

    const post = new Purchase({
      user: userId,
      event: purchase.event,
      tickets: 1,
      totalPrice: Number(purchase.totalPrice),
      remainig_ticket: 1,
      tickets_type_sale: {
        type: purchase.tickets_type_sale.type,
        totalTicket: 1,
        price: Number(purchase.tickets_type_sale.price),
        code: ticketCode(),
        scanned: [],
      },
      resel_by: ownerUser,
    });

    await Purchase.findOneAndUpdate(
      { _id: purchaseId },
      {
        $pull: { "tickets_type_sale.code": purchaseCode },
        remainig_ticket: Number(purchase.remainig_ticket) - 1,
      }
    );

    const event = await Post.findById(purchase.event).lean();

    if (!event) return res.status(404).json({ message: "Event not found." });

    const to_User = await User.findById(userId).select("fcmtoken").lean();

    await sendNotification({
      user: ownerUser,
      to_id: userId,
      description: `${purchase.user?.name} has transfer 1 ticket of ${event.name} event to you.`,
      type: "transfer",
      title: "Ticket transfer",
      fcmtoken: to_User?.fcmtoken,
      event: purchase.event,
      purchase: post._id,
    });

    await post.save();
    res.status(201).json({
      success: true,
      message: "Ticket purchase successfully",
      ticket: post,
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
      `https://jad.cash/HAPI/token?apikey=${clientId}&secret=${apiSecret}&grant_type=credentials`
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
      }
    );
    res.status(201).json({ success: true, response: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updatePurchaseScan = async (req, res) => {
  try {
    const ownerUser = req?.user?._id || "";
    const userId = req.params.userId;
    const eventId = req.params.eventId;
    const purchaseId = req.params.purchaseId;
    const purchaseCode = req.params.code;

    const scannedAtRaw = req.body?.scannedAt;
    const scannedAt =
      scannedAtRaw != null &&
      !Number.isNaN(new Date(scannedAtRaw).getTime())
        ? new Date(scannedAtRaw)
        : new Date();

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
            code: logCode,
            scannedAt,
          },
        },
      },
      { new: true }
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
            options: { limit: 3 },
            populate: [{ path: "user", model: "user" }],
          },
        ],
      });

    if (!purchase)
      return res
        .status(404)
        .json({ message: "Ticket did not found or has already been scanned." });

    res.status(200).json({ success: true, post: purchase });
  } catch (error) {
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

exports.getPurchase = async (req, res) => {
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
      .populate("ResellTickets")
      .populate("resellpurchases")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Purchase.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    if (likedJobs.length > 0) {
      for (let purchase of likedJobs) {
        purchase.event.TotalLikes = purchase.event.likes?.length;
        purchase.event.likes = userId
          ? Array.isArray(purchase.event.likes) &&
            purchase.event.likes.some(
              (like) => like.user.toString() === userId.toString()
            )
          : false;
      }
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
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const totalCount = await Purchase.countDocuments(query);
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
    "status"
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
    console.log("createAdminTicket", req.body);
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
    console.log("updateAdminTicket", req.body);
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
      { new: true, runValidators: true }
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
  const p =
    purchase && typeof purchase.toObject === "function"
      ? purchase.toObject()
      : { ...purchase };
  const tts = p.tickets_type_sale;
  if (!tts) return p;
  const codes = Array.isArray(tts.code) ? tts.code : [];
  const scannedArr = Array.isArray(tts.scanned)
    ? tts.scanned.map((c) => String(c))
    : [];
  const log = Array.isArray(tts.scannedAtLog) ? tts.scannedAtLog : [];
  const latestByCode = {};
  for (const row of log) {
    if (row == null || row.scannedAt == null) continue;
    const key = String(row.code);
    const t = new Date(row.scannedAt).getTime();
    if (Number.isNaN(t)) continue;
    const prev = latestByCode[key];
    if (
      prev == null ||
      t >= new Date(prev).getTime()
    ) {
      latestByCode[key] = row.scannedAt;
    }
  }
  p.ticketCodes = codes.map((code) => ({
    code,
    scanned: scannedArr.includes(String(code)),
    scannedAt: latestByCode[String(code)] ?? null,
  }));
  return p;
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
        { $unwind: "$supplier" }
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
          .populate(["event", "supplier", "tickets"]),
        AdminTicket.countDocuments(baseFilter),
      ]);
    }

    let purchases = [];
    if (eventId && userId) {
      const eventDoc = await Post.findById(eventId).select("user").lean();
      if (
        eventDoc &&
        String(eventDoc.user) === String(userId)
      ) {
        const purchaseDocs = await Purchase.find({ event: eventId })
          .populate("user", "name email phone")
          .sort({ createdAt: -1 })
          .lean();
        purchases = purchaseDocs.map((doc) => enrichPurchaseWithScannedAt(doc));
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
      { $pull: { tickets: printTicket._id } }
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
    const supplierId = req.user._id;
    const eventId = req.params.eventId;
    const adminTicket = await AdminTicket.findOne({
      supplier: supplierId,
      event: eventId,
      tickets: { $in: [req.params.id] },
    })
      .populate("event")
      .populate({
        path: "event",
        populate: {
          path: "user",
        },
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
    printTicket.scanned = true;
    await printTicket.save();

    res.status(200).json({
      success: true,
      message: "Print ticket scanned successfully",
      data: adminTicket,
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
          Number(tickets)
        ),
      },
      { new: true }
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
      tickets_type_sale[0].type
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
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    const user = await User.findById(purchase.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    purchase.installmentPlans = installmentPlans;
    if (isinstallment === false) {
      purchase.isinstallment = isinstallment;
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
