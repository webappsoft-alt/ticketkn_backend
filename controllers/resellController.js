const { default: mongoose } = require("mongoose");
const Event = require("../models/Event");
const Purchase = require("../models/Purchase");
const Resell = require("../models/Resell");
const Transaction = require("../models/Transaction");
const { User } = require("../models/user");
const { purchaseEmail } = require("./emailservice");
const { ticketCode } = require("./generateCode");
const { sendNotification } = require("./notificationCreateService");


function validateTicketArray(mainArray, secondaryArray) {
  // Step 1: Create a map from the main array for easy lookup
  const mainMap = {};
  for (const ticket of mainArray) {
    mainMap[ticket.type] = ticket.totalTicket;
  }

  // Step 2: Validate each object in the secondary array
  for (const ticket of secondaryArray) {
    // Check if the type exists in the main array and is allowed
    if (!(ticket.type in mainMap)) {
      return `Invalid type: ${ticket.type} is not allowed.`;
    }

    // Check if the totalTicket count does not exceed the count in the main array
    if (ticket.totalTicket > mainMap[ticket.type]) {
      return `Invalid totalTicket for type ${ticket.type}: exceeds limit of ${mainMap[ticket.type]}.`;
    }
  }

  return ""; // If no errors were found, validation passed
}

exports.createPost = async (req, res) => {
  try {
    const {
      purchase_ticketId,
      code,
      price,
      type
    } = req.body;

    const purchase = await Purchase.findOne({ _id: purchase_ticketId, "tickets_type_sale.code": { $in: code } })

    if (!purchase) return res.status(400).json({ success: true, message: "Tickets are not found." });

    const resell = new Resell({
      user: purchase.user,
      event: purchase.event,
      purchase_ticketId,
      price,
      type
    });

    await Purchase.findOneAndUpdate(
      { _id: purchase_ticketId },
      { $pull: { "tickets_type_sale.code": code }, remainig_ticket: Number(purchase.remainig_ticket) - 1 }
    );
    await resell.save();
    res.status(200).json({ success: true, message: "Resell tickets created successfully", resell });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getMyResellTickets = async (req, res) => {
  const userId = req.user._id
  console.log(userId)
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query = { event: { $exists: true, $ne: null } };
  const pageSize = 10;
  query.user = new mongoose.Types.ObjectId(userId);
  // query.resellTickets={ $exists: false, $ne: null  }

  const skip = Math.max(0, (lastId - 1)) * pageSize;
  try {
    const filteredJobs = await Resell.aggregate([
      // 1. Initial Query Filter
      { $match: query },

      // 2. Filter out records where Event does not exist in DB
      {
        $lookup: {
          from: "events", // Ensure this matches your actual Event collection name
          localField: "event",
          foreignField: "_id",
          as: "eventCheck"
        }
      },
      { $match: { "eventCheck.0": { $exists: true } } },

      // 3. Sorting & Pagination (Executed early for performance)
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: pageSize },

      // 4. Populate: user
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // 5. Populate: resellTickets & inside resellTickets -> user
      {
        $lookup: {
          from: "reselltickets", // Ensure collection name matches
          localField: "resellTickets",
          foreignField: "_id",
          as: "resellTickets"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "resellTickets.user",
          foreignField: "_id",
          as: "resellTicketsUsers"
        }
      },
      {
        $addFields: {
          resellTickets: {
            $map: {
              input: "$resellTickets",
              as: "ticket",
              in: {
                $mergeObjects: [
                  "$$ticket",
                  {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$resellTicketsUsers",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$ticket.user"] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 6. Populate: event -> Main processing from the earlier check
      { $addFields: { event: { $arrayElemAt: ["$eventCheck", 0] } } },

      // 7. Populate deeply nested fields inside event (user, category, likes, coupon, purchase_by)
      {
        $lookup: {
          from: "users",
          localField: "event.user",
          foreignField: "_id",
          as: "eventUser"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "event.category",
          foreignField: "_id",
          as: "eventCategory"
        }
      },
      {
        $lookup: {
          from: "likes",
          localField: "event.likes",
          foreignField: "_id",
          as: "eventLikes"
        }
      },
      {
        $lookup: {
          from: "coupons",
          localField: "event.coupon",
          foreignField: "_id",
          as: "eventCoupon"
        }
      },
      {
        $lookup: {
          from: "purchases",
          localField: "event.purchase_by",
          foreignField: "_id",
          as: "eventPurchases"
        }
      },
      // Populate user inside purchase_by
      {
        $lookup: {
          from: "users",
          localField: "eventPurchases.user",
          foreignField: "_id",
          as: "purchaseUsers"
        }
      },

      // 8. Reconstruct the exact final response structure
      {
        $addFields: {
          "event.user": { $arrayElemAt: ["$eventUser", 0] },
          "event.category": { $arrayElemAt: ["$eventCategory", 0] },
          "event.likes": "$eventLikes",
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
                                cond: { $eq: ["$$pu._id", "$$p.user"] }
                              }
                            },
                            0
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              3 // Limit purchase_by to 3 items as per your options
            ]
          }
        }
      },

      // 9. Clean up temporary pipeline fields before returning data
      {
        $project: {
          eventCheck: 0,
          resellTicketsUsers: 0,
          eventUser: 0,
          eventCategory: 0,
          eventLikes: 0,
          eventCoupon: 0,
          eventPurchases: 0,
          purchaseUsers: 0
        }
      }
    ]);
    const totalCount = await Resell.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);


    if (filteredJobs.length > 0) {
      for (let purchase of filteredJobs) {
        if (purchase.event) {
          purchase.event.TotalLikes = purchase.event.likes?.length || 0
          purchase.event.likes = userId ? Array.isArray(purchase.event.likes) && purchase.event.likes.some(like => like.user.toString() === userId.toString()) : false
        }
      }
      res.status(200).json({ success: true, posts: filteredJobs, count: { totalPage: totalPages, currentPageSize: filteredJobs.length } });
    } else {
      res.status(200).json({ success: false, message: 'No more resell tickets found', posts: [], count: { totalPage: totalPages, currentPageSize: filteredJobs.length } });
    }
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.otherResellEvents = async (req, res) => {
  const userId = req?.user?._id || ""
  const lastId = parseInt(req.params.id) || 1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query = {};

  const pageSize = 10;

  const skip = Math.max(0, (lastId - 1)) * pageSize;
  query.user = { $ne: userId };
  query.resellTickets = { $exists: false }
  console.log("query", JSON.stringify(query, null, 2));
  try {
    const likedJobs = await Resell.aggregate([
      // 1. Initial Query Filter
      { $match: query },

      // 2. Filter out records where Event does not exist in DB
      {
        $lookup: {
          from: "events", // Ensure this matches your actual Event collection name
          localField: "event",
          foreignField: "_id",
          as: "eventCheck"
        }
      },
      { $match: { "eventCheck.0": { $exists: true } } },

      // 3. Sorting & Pagination (Executed early for performance)
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: pageSize },

      // 4. Populate: user
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // 5. Populate: resellTickets & inside resellTickets -> user
      {
        $lookup: {
          from: "purchases", // Ensure collection name matches
          localField: "resellTickets",
          foreignField: "_id",
          as: "resellTickets"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "resellTickets.user",
          foreignField: "_id",
          as: "resellTicketsUsers"
        }
      },
      {
        $addFields: {
          resellTickets: {
            $map: {
              input: "$resellTickets",
              as: "ticket",
              in: {
                $mergeObjects: [
                  "$$ticket",
                  {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$resellTicketsUsers",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$ticket.user"] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 6. Populate: event -> Main processing from the earlier check
      { $addFields: { event: { $arrayElemAt: ["$eventCheck", 0] } } },

      // 7. Populate deeply nested fields inside event (user, category, likes, coupon, purchase_by)
      {
        $lookup: {
          from: "users",
          localField: "event.user",
          foreignField: "_id",
          as: "eventUser"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "event.category",
          foreignField: "_id",
          as: "eventCategory"
        }
      },
      {
        $lookup: {
          from: "likes",
          localField: "event.likes",
          foreignField: "_id",
          as: "eventLikes"
        }
      },
      {
        $lookup: {
          from: "coupons",
          localField: "event.coupon",
          foreignField: "_id",
          as: "eventCoupon"
        }
      },
      {
        $lookup: {
          from: "purchases",
          localField: "event.purchase_by",
          foreignField: "_id",
          as: "eventPurchases"
        }
      },
      // Populate user inside purchase_by
      {
        $lookup: {
          from: "users",
          localField: "eventPurchases.user",
          foreignField: "_id",
          as: "purchaseUsers"
        }
      },

      // 8. Reconstruct the exact final response structure
      {
        $addFields: {
          "event.user": { $arrayElemAt: ["$eventUser", 0] },
          "event.category": { $arrayElemAt: ["$eventCategory", 0] },
          "event.likes": "$eventLikes",
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
                                cond: { $eq: ["$$pu._id", "$$p.user"] }
                              }
                            },
                            0
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              3 // Limit purchase_by to 3 items as per your options
            ]
          }
        }
      },

      // 9. Clean up temporary pipeline fields before returning data
      {
        $project: {
          eventCheck: 0,
          resellTicketsUsers: 0,
          eventUser: 0,
          eventCategory: 0,
          eventLikes: 0,
          eventCoupon: 0,
          eventPurchases: 0,
          purchaseUsers: 0
        }
      }
    ]);

    const totalCount = await Resell.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);
    console.log("likedJobs", JSON.stringify(likedJobs, null, 2));

    if (likedJobs.length > 0) {
      for (let purchase of likedJobs) {
        if (purchase.event) {
          purchase.event.TotalLikes = purchase.event.likes?.length || 0
          purchase.event.likes = userId ? Array.isArray(purchase.event.likes) && purchase.event.likes.some(like => like.user.toString() === userId.toString()) : false
        }
      }
      res.status(200).json({ success: true, posts: likedJobs, count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    } else {
      res.status(200).json({ success: false, message: 'No more resell tickets found', posts: [], count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

function convertToUKFormat(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

exports.purchaseTicket = async (req, res) => {
  const userId = req.user._id;
  const eventId = req.params.id;

  const { type } = req.body;

  try {
    const findEvent = await Resell.findOne({ _id: eventId, resellTickets: { $exists: false } }).populate("user")

    if (!findEvent) return res.status(404).json({ message: "Resel ticket has already been booked by anyother user." });

    const post = new Purchase({
      user: userId,
      event: findEvent.event,
      tickets: 1,
      totalPrice: Number(findEvent.price),
      remainig_ticket: 1,
      tickets_type_sale: {
        type: findEvent.type,
        totalTicket: 1,
        price: Number(findEvent.price),
        code: ticketCode(),
        scanned: []
      },
      resel_by: findEvent.user._id,
      type
    })
    console.log(" findEvent.purchase_ticketId", findEvent.purchase_ticketId)
    const purchase = await Purchase.findOneAndUpdate({ _id: findEvent.purchase_ticketId }, { $push: { "resellpurchases": post._id } })
    if (!purchase) return res.status(404).json({ message: "Resell tickets not found with that Id" });
    const event = await Event.findById(findEvent.event).populate("user category").lean()

    if (!event) return res.status(404).json({ message: 'Event not found.' });


    const logInuser = await User.findById(userId).select("email").lean()

    const ukFormattedDate = convertToUKFormat(event.start_Date);

    await purchaseEmail(logInuser.email, event.name, ukFormattedDate, event.category.name, findEvent.type,)

    findEvent.resellTickets = post._id

    const twentyPer = Number(findEvent.price) * 0.20

    await sendNotification({
      user: userId,
      to_id: findEvent.user._id,
      description: `Someone has purchased your resell 1 tickets of your ${findEvent.event.name} booked event`,
      type: 'purchase',
      title: "New Resell Ticket Purchase",
      fcmtoken: findEvent.user?.fcmtoken,
      event: eventId,
      purchase: post._id
    })

    const user = await User.findById(findEvent.user._id);

    const transaction = new Transaction({
      user: findEvent.user._id,
      ticket: findEvent.purchase_ticketId,
      total_price: Number(findEvent.price) - Number(twentyPer),
      type: "deposit",
      originalPrice: Number(findEvent.price)
    });
    await transaction.save();


    const balance = Number(user?.balance) || 0;
    const totalPrice = Number(findEvent.price) - Number(twentyPer) || 0;

    user.balance = balance + totalPrice;
    await user.save();
    await findEvent.save();

    await post.save();
    res.status(201).json({ success: true, message: 'Ticket purchase successfully', ticket: post });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.deleteResellTicket = async (req, res) => {
  const eventId = req.params.id;
  try {
    const findEvent = await Resell.findOneAndDelete({ _id: eventId, resellTickets: { $exists: false } }).populate("user").lean()

    if (!findEvent) return res.status(404).json({ message: "Resell tickets not found with that Id" });

    const purchase = await Purchase.findById(findEvent.purchase_ticketId)

    if (!purchase) return res.status(404).json({ message: "Resell tickets not found with that Id" });

    await Purchase.findOneAndUpdate(
      { _id: findEvent.purchase_ticketId },
      { $push: { "tickets_type_sale.code": ticketCode() }, remainig_ticket: Number(purchase.remainig_ticket) + 1 }
    );

    res.status(201).json({ success: true, message: 'Resel Ticket delete successfully', ticket: findEvent });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.adminResellEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const findEvents = await Resell.find({ resellTickets: { $exists: true } })
      .populate("user")
      .populate({ path: "purchase_ticketId", populate: "user" })
      .populate({ path: "resellTickets", populate: "user" })
      .populate({ path: "event", populate: ["user", "purchase_by", "category"] })
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean()

    const totalCount = await Resell.countDocuments({ resellTickets: { $exists: true } })
    const totalPages = Math.ceil(totalCount / Number(limit))

    res.status(200).json({
      success: true,
      message: 'Resell tickets found successfully',
      data: findEvents,
      page: {
        totalPage: totalPages,
        currentPageSize: findEvents.length,
        currentPage: Number(page)
      }
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};