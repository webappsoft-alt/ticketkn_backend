const { default: axios } = require('axios');
const Post = require('../models/Event');
const like = require('../models/like');
const Purchase = require('../models/Purchase');
const { sendNotification } = require('./notificationCreateService');
const { User } = require('../models/user');
const admin = require("firebase-admin");
const Coupon = require('../models/Coupon');
const Category = require('../models/Category');
const { ticketCode } = require('./generateCode');

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
      category
     } = req.body;
    const userId = req.user._id;

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
      tickets_sale:[{ type:"general", totalTicket:0},{type: 'vip',totalTicket:0},{type:'vvip',totalTicket:0},{type:"earlybird",totalTicket:0}]
    })

    const users=await User.find({ type:"customer",status:"online" }).select("fcmtoken").lean();
    const cat=await Category.findById(category).select("name").lean();


    const fcmTokens = [...new Set(users.map(item => item.fcmtoken).filter(item=>item!==undefined||item!==""))];
    if (fcmTokens.length > 0) {
      // Create an array of message objects for each token
      const messages = fcmTokens.map(token => ({
        token: token,
        notification: {
            title: 'New Event',
            body: `A new Event "${name}" has been created in ${cat.name} area.`,
        },
        android: {
            notification: {
                sound: 'default',
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                },
            },
        },
      }));
      try {
        await admin.messaging().sendEach(messages)
      } catch (error) {}
    }

      
    await post.save();
    res.status(201).json({ success: true, message: 'Event created successfully', post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
    }).filter(([key, value]) => value !== undefined)
  );

  // Check if there are any fields to update
  if (Object.keys(updateFields).length === 0) {
    return res.status(400).send({ success: false, message: 'No valid fields provided for update.' });
  }
    const post = await Post.findOneAndUpdate({_id:postId}, updateFields, {
      new: true
    });

    if (!post) return res.status(404).send({ success: false, message: 'The Event with the given ID was not found.' });

    res.send({ success: true, message: 'Event updated successfully', post:post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyPosts = async (req, res) => {
  const lastId = parseInt(req.params.id)||1;
  const userId = req?.user?._id||""

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};
  query.status='active'
  query.user=userId


  const users = await Post.find(query).populate("user").populate("likes").populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("coupon").populate("category").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0
    posts.likes = Array.isArray(posts.likes) && posts.likes.some(like => like.user.toString() === userId.toString());
  }
  
  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
};

exports.updatePurchasePaymentByAdmin = async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Purchase.findOneAndUpdate({_id:postId}, {paymentDone:true}, {new: true});

    if (!post) return res.status(404).send({ success: false, message: 'The Purchase with the given ID was not found.' });

    res.send({ success: true, message: 'Purchase payed successfully', purchase:post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getAdminPurchases = async (req, res) => {
  const lastId = parseInt(req.params.id)||1;
  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};

  if (req.body.event!=='all') {
    query.event=req.body.event;
  }
  if (req.body.paymentDone) {
    query.paymentDone=req.body.paymentDone;
  }

  const users = await Purchase.find(query).populate("user").populate("event").populate("ResellTickets").populate("resellpurchases").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  
  const totalCount = await Purchase.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, purchases: users,count: { totalPage: totalPages, currentPageSize: users.length } });
};


exports.latestEvent = async (req, res) => {
  const userId = req?.user?._id||""
  
  let query = {};
  query.status='active'
  query.user=userId

  // Get the current date and time (now)
  const now = new Date();
    
  // Only retrieve upcoming events (those with start_Date in the future)
  query.start_Date = { $gte: now };


  const users = await Post.find(query).populate("user").populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("category").populate("coupon").sort({ start_Date: 1 }).limit(1).lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0
    posts.likes = Array.isArray(posts.likes) && posts.likes.some(like => like.user.toString() === userId.toString());
  }
    
  res.send({ success: true, posts: users});
};

exports.getAdminPost = async (req, res) => {
  const lastId = parseInt(req.params.id)||1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};
  query.status='active'
  if (req.params.type!=='all') {
    query.category = req.params.type; 
  }


  const users = await Post.find(query).populate("user").populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("category").populate("coupon").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  
  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
};

exports.noCouponEvent = async (req, res) => {
  const userId = req?.user?._id||""
  let query = {};
   // Get the current date and time (now)
   const now = new Date();
    
   // Only retrieve upcoming events (those with start_Date in the future)
   query.start_Date = { $gte: now };
   query.status= "active";
   query.coupon= null;
   query.user= userId;

  const users = await Post.find(query).populate("user").populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("category").sort({ _id: -1 }).limit(15).lean();
    
  res.send({ success: true, posts: users});
};

exports.filterPosts = async (req, res) => {
  const lastId = parseInt(req.body.last_id)||1;
  const userId = req?.user?._id||""

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};

  query.status='active'

  if (req.body.search) {
    query.name= { $regex: new RegExp(req.body.search, 'i') };
  }

  if (req.body.today=="true"||req.body.today==true) {
    // Get the current date and time (now)
    const now = new Date();
    
    // Only retrieve upcoming events (those with start_Date in the future)
    query.start_Date = { $gte: now };
  }

  if (req.body.otherId) {
    query.user = req.body.otherId; 
  }
  if (req.body.category) {
    query.category = req.body.category; 
  }

  if (req.body.address) {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(404).send({ message: 'Latitude and Longitude are required',posts:[] });
    }

    const radiusInMiles = 20;
    const radiusInMeters = radiusInMiles * 1609.34; // Convert miles to meters
  
    const users = await Post.find({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
    })
    .populate("user").populate("likes").populate("coupon").populate("category").skip(skip).limit(pageSize).lean();

    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0
      post.likes = userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
      post.purchase_by = userId? Array.isArray(post.purchase_by) && post.purchase_by.some(like => like.toString() === userId.toString()):false;
    }
    
    const totalCount = await Post.find({...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
  });
    const totalPages = Math.ceil(totalCount.length / pageSize);
    
    res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
  }else if (req.body.popular) {

    const users = await Post.find(query).populate({
      path: 'purchase_by',
      options: { limit: 3 }, // Limit to 3 users
      populate: [
        { path: 'user', model: 'user' },
      ]
    }).populate("user").populate("likes").populate("coupon").populate("category").sort({ total_tickets_sale: -1 }).skip(skip).limit(pageSize).lean();
    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0
      post.likes =userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
    }
    
    const totalCount = await Post.find(query);
    const totalPages = Math.ceil(totalCount.length / pageSize);
    
   return res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });

   
// const events = await Post.aggregate([
//   {
//     $addFields: {
//       purchaseCount: { $size: "$purchase_by" } // Temporary field to count `purchase_by` length
//     }
//   },
//   {
//     $sort: { purchaseCount: -1, _id: -1 } // Sort by purchase count descending
//   },
//   {
//     $skip: skip
//   },
//   {
//     $limit: pageSize
//   },
//   {
//     $lookup: {
//       from: 'purchases', // Assuming `purchase_by` references the `Purchase` collection
//       localField: 'purchase_by',
//       foreignField: '_id',
//       as: 'purchase_by'
//     }
//   },
//   {
//     $lookup: {
//       from: 'users',
//       let: { purchaseUserIds: "$purchase_by.user" },
//       pipeline: [
//         { $match: { $expr: { $in: ["$_id", "$$purchaseUserIds"] } } },
//         { $limit: 3 } // Limit to 3 users per `purchase_by` entry
//       ],
//       as: 'purchase_users'
//     }
//   },
//   {
//     $lookup: {
//       from: 'users',
//       localField: 'user',
//       foreignField: '_id',
//       as: 'user'
//     }
//   },
//   {
//     $lookup: {
//       from: 'likes',
//       localField: 'likes',
//       foreignField: '_id',
//       as: 'likes'
//     }
//   },
//   {
//     $lookup: {
//       from: 'coupons',
//       localField: 'coupon',
//       foreignField: '_id',
//       as: 'coupon'
//     }
//   },
//   {
//     $lookup: {
//       from: 'categories',
//       localField: 'category',
//       foreignField: '_id',
//       as: 'category'
//     }
//   },
//   {
//     $addFields: {
//       "purchase_by.user": { $slice: ["$purchase_users", 3] } // Limit the users in each `purchase_by` entry to 3
//     }
//   },
//   {
//     $project: {
//       purchaseCount: 0 // Only exclude `purchaseCount` since it's a temporary field
//     }
//   }
// ]);
//     // Post-process for total likes and user-specific likes if needed
//     for (const post of events) {
//       post.TotalLikes = post.likes ? post.likes.length : 0;
//       post.likes = userId
//         ? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString())
//         : false;
//     }
    
//    return res.send({ success: true, events: events});
  

} {

  const users = await Post.find(query).populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("user").populate("likes").populate("coupon").populate("category").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  for (const post of users) {
    post.TotalLikes = post?.likes?.length || 0
    post.likes =userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
  }
  
  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
}};

exports.getDetailsEvent = async (req, res) => {
  const userId = req?.user?._id||""
  const postId = req?.params?.id||""

  const post = await Post.findById(postId).populate({
    path: 'purchase_by',
    options: { limit: 3 }, // Limit to 3 users
    populate: [
      { path: 'user', model: 'user' },
    ]
  }).populate("user").populate("likes").populate("coupon").populate("category").lean();

  const TotalLikes = post?.likes?.length || 0
  const likes = userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
    
  res.send({ success: true, post: {...post,TotalLikes,likes} });
};


exports.deletePostById = async (req, res) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findOneAndUpdate({ _id: postId },{status:'deleted'},{new:true});

    if (!deletedPost) {
      return res.status(404).json({ message: 'Event not found or user does not have permission to delete it' });
    }

    res.status(200).json({ message: 'Event deleted successfully', post: deletedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
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
      event: postId
    });


    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $push: { likes: likePost._id } },
      { new: true }
    ).populate("user")

    if (!updatedPost) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await likePost.save()

    res.status(200).json({ message: 'Like added successfully', post: updatedPost });
  } catch (error) {

    console.log(error)
    res.status(500).json({ message: 'Internal server error' });
  }
};

const dislike = async (postId, res, userId) => {
  try {

    const deletedLike = await like.findOneAndDelete({ event: postId,user: userId, });

    if (!deletedLike) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: deletedLike._id } },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json({ message: 'Like deleted successfully', post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.getMyFavPosts = async (req, res) => {
  const userId = req.user._id
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
    if (isNaN(lastId) || lastId < 0) {
      return res.status(400).json({ error: 'Invalid last_id' });
    }
    let query={};
  
    const pageSize = 10;
    
    const skip = Math.max(0, (lastId - 1)) * pageSize;

  query.user = userId;
  try {
    const likedJobs = await like.find(query)
      .populate({
        path: 'event',
        populate: [
          { path: 'user', model: 'user' },
          { path: 'category', model: 'Category' },
          { path: 'coupon', model: 'Coupon' },
          { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
        ]
      }).sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await like.countDocuments(query);
      const totalPages = Math.ceil(totalCount / pageSize);
    

    const jobs = likedJobs.map((like) => like.event);
    if (jobs.length > 0) {
      const UpdateFav = jobs.map(order => {
        return {
          ...order,       // Spread operator to copy existing properties
          likes: true // Adding new key with a value
        };
      });
      res.status(200).json({ success: true, posts: UpdateFav,count: { totalPage: totalPages, currentPageSize: jobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more favorite Events found',posts:[] ,count: { totalPage: totalPages, currentPageSize: jobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.purchaseTicket = async (req, res) => {
  const userId = req.user._id;
  const eventId=req.params.id;

  try {
    const {totalPrice,tickets,tickets_sale,tickets_type_sale,couponId}=req.body;

    const findEvent = await Post.findById(eventId).lean()

    if (Number(findEvent.total_tickets_sale+Number(tickets))>Number(findEvent.join_people)) {
      return res.status(404).json({ message: "Event's tickets are fully sold" });
    }

    const eightPerc=Number(totalPrice) * 0.08

    const totalPriceValue=Number(totalPrice) - Number(eightPerc)
    const twoPer=Number(totalPriceValue) * 0.02

    const post = new Purchase({
      user: userId,
      event:eventId,
      tickets:tickets,
      totalPrice:totalPriceValue,
      ownerPrice:Number(totalPriceValue) - Number(twoPer),
      tickets_type_sale:tickets_type_sale,
      remainig_ticket:tickets,
      code:ticketCode()
    })

    const event = await Post.findByIdAndUpdate(eventId, { $addToSet : { purchase_by : post._id },total_tickets_sale:Number(findEvent.total_tickets_sale)+Number(tickets),tickets_sale },{new:true}).populate("user").lean()

    if (!event) return res.status(404).json({ message: 'Event not found.' });

    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId,{$addToSet:{used_by:userId}}).lean();
    }


    await sendNotification({
      user : userId,
      to_id : event.user._id,
      description :  `Someone has purchased ${tickets} tickets of your ${event.name}`,
      type :'purchase',
      title :"New Ticket Purchase",
      fcmtoken : event.user?.fcmtoken,
      event:eventId,
      purchase:post._id
  })
    
    await post.save();
    res.status(201).json({ success: true, message: 'Ticket purchase successfully', ticket:post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
exports.paymentDone = async (req, res) => {

  try {
    const body={ 
      "live": 0,
      "timestamp": "20240726190607",
      "refnum": "123123123123",
      "jadnumber": "101310573865",
      "amount": "277.99",
      "cardnumber": "4444111122223333",
      "cardexpmonth": "09",
      "cardexpyear": "2045",
      "cardcvv": "123",
      "cardfirstname": "Naee1m",
      "cardlastname": "Junejo",
      "address": "wqewds ",
      "city": "sdssa",
      "state": "KNK",
      "postalcode": "123123",
      "country": "KN",
      "email": "alrandw@gmail.com",
      "phone": ""
    }
     const clientId="0FGR7.1720815360"
     const apiSecret="6EF4CAFCD82E689DECA28EDFDE15ADB35D12BF5982B182E468758A9F8DD072DF"

     const response=await axios.get(`https://jad.cash/HAPI/token?apikey=${clientId}&secret=${apiSecret}&grant_type=credentials`)
     const result=await axios.post("https://jad.cash/HAPI/cardpayment",{
      token:response.data.data.token,
      paydata:body
     },{
      headers:{
        "Content-Type":"application/json"
      }
     })
      res.status(201).json({ success: true, response:result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updatePurchaseScan = async (req, res) => {
  try {
    const ownerUser = req?.user?._id||""
    const userId = req.params.userId;
    const eventId = req.params.eventId;
    const code = req.params.code;

    const event=await Post.findOne({_id:eventId,user:ownerUser})

    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const purchase = await Purchase.findOneAndUpdate({ user: userId,event:eventId,scanner:false,code:code },{scanner:true},{new:true}).populate("ResellTickets").populate("resellpurchases").populate("user").populate({
      path: 'event',
      populate: [
        { path: 'user', model: 'user' },
        { path: 'category', model: 'Category' },
        { path: 'coupon', model: 'Coupon' },
        { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
      ]
    });

    if (!purchase) return res.status(404).json({ message: 'Ticket did not found or has already been scanned.' });

    res.status(200).json({ success:true, post: purchase });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getPurchaseTicket = async (req, res) => {
  try {
    const userId = req.params.userId;
    const eventId = req.params.eventId;
    const code = req.params.code;

    const event = await Purchase.findOne({ user: userId,event:eventId,scanner:false,code:code }).populate("ResellTickets").populate("resellpurchases").populate("user").populate({
      path: 'event',
      populate: [
        { path: 'user', model: 'user' },
        { path: 'category', model: 'Category' },
        { path: 'coupon', model: 'Coupon' },
        { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
      ]
    });

    if (!event) return res.status(404).json({ message: 'Ticket did not found or has already been scanned.' });

    if (event.resellticket >= event.tickets) return res.status(404).json({ message: "You have resell all of your tickets already." });
    
    res.status(200).json({ success:true, post: event });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};



exports.getPurchase = async (req, res) => {
  const userId = req.user._id
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query={};

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  query.user = userId;
  try {
    const likedJobs = await Purchase.find(query).populate({
      path: 'event',
      populate: [
        { path: 'user', model: 'user' },
        { path: 'category', model: 'Category' },
        { path: 'likes', model: 'Like' },
        { path: 'coupon', model: 'Coupon' },
        { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
      ]
    }).populate("ResellTickets").populate("resellpurchases").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await Purchase.countDocuments(query);
      const totalPages = Math.ceil(totalCount / pageSize);
    

    if (likedJobs.length > 0) {
      for (let purchase of likedJobs) {
        purchase.event.TotalLikes=purchase.event.likes?.length
        purchase.event.likes=userId? Array.isArray(purchase.event.likes) && purchase.event.likes.some(like => like.user.toString() === userId.toString()):false
      }
      res.status(200).json({ success: true, posts: likedJobs,count: { totalPage: totalPages, currentPageSize: likedJobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more purchase events found',posts:[] ,count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
exports.eventsPurchases = async (req, res) => {
  const event = req.params.eventId
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query={};

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  query.event = event;

  try {
    const likedJobs = await Purchase.find(query).populate("user").populate("ResellTickets").populate("resellpurchases").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await Purchase.countDocuments(query);
      const totalPages = Math.ceil(totalCount / pageSize);
    if (likedJobs.length > 0) {
      res.status(200).json({ success: true, purchases: likedJobs,count: { totalPage: totalPages, currentPageSize: likedJobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more purchase purchases found',purchases:[] ,count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyPurchases = async (req, res) => {
  const userId = req.user._id
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;

  const events = await Post.find({user:userId,status:"active"}).select("status")

  const totalEvents=events.map(item=>item._id)

  try {
    const likedJobs = await Purchase.find({event:{$in:totalEvents},resel_by: { $exists: false }}).populate("user").populate("ResellTickets").populate("resellpurchases").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await Purchase.countDocuments({event:{$in:totalEvents},resel_by: { $exists: false }});
      const totalPages = Math.ceil(totalCount / pageSize);
    if (likedJobs.length > 0) {
      res.status(200).json({ success: true, purchases: likedJobs,count: { totalPage: totalPages, currentPageSize: likedJobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more purchase purchases found',purchases:[] ,count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};