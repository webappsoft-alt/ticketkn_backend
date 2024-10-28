const Purchase = require("../models/Purchase");
const Resell = require("../models/Resell");
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
      purchaseTickets,
      tickets,
      tickets_type_sale,
      totalPrice
    } = req.body;

    const purchase=await Purchase.findById(purchaseTickets)

    if (!purchase) return res.status(400).json({success: true,message: "Tickets are not found."});

    if (Number(purchase.tickets) > Number(tickets)) return res.status(400).json({success: true,message: "Resell Ticket should not be more than purchase tickets."});

    const error = validateTicketArray(purchase.tickets_type_sale, tickets_type_sale)

    if (error !== "") return res.status(400).json({success: true,message: error});
    
    const resell = new Resell({
      user:purchase.user,
      event:purchase.event,
      tickets,
      tickets_type_sale,
      totalPrice,
      purchaseTickets,
      remaining_tickets:tickets
    });

    purchase.ResellTickets=resell._id
    
    await purchase.save();

    await resell.save();
    res.status(200).json({success: true,message: "Resell tickets created successfully",resell});
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


exports.editResellTickets = async (req, res) => {
  try {
    const { 
      tickets,
      tickets_type_sale,
      totalPrice,
    } = req.body;

    const postId = req.params.id;

    // Create an object to store the fields to be updated
  let updateFields = Object.fromEntries(
    Object.entries({
      tickets,
      tickets_type_sale,
      totalPrice
    }).filter(([key, value]) => value !== undefined)
  );

  // Check if there are any fields to update
  if (Object.keys(updateFields).length === 0) {
    return res.status(400).send({ success: false, message: 'No valid fields provided for update.' });
  }
    const post = await Resell.findOneAndUpdate({_id:postId}, updateFields, {
      new: true
    });

    if (!post) return res.status(404).send({ success: false, message: 'The Resell Ticket with the given ID was not found.' });

    res.send({ success: true, message: 'Resell Ticket updated successfully', post:post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


exports.getMyResellTickets = async (req, res) => {
  const userId = req.user._id
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query={};

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  try {
    const likedJobs = await Resell.find(query).populate({
      path: 'event',
      populate: [
        { path: 'user', model: 'user' },
        { path: 'category', model: 'Category' },
        { path: 'likes', model: 'Like' },
        { path: 'coupon', model: 'Coupon' },
        { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
      ]
    }).sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await Resell.countDocuments(query);
      const totalPages = Math.ceil(totalCount / pageSize);
    

    if (likedJobs.length > 0) {
      for (let purchase of likedJobs) {
        purchase.event.TotalLikes=purchase.event.likes?.length
        purchase.event.likes=userId? Array.isArray(purchase.event.likes) && purchase.event.likes.some(like => like.user.toString() === userId.toString()):false
      }
      res.status(200).json({ success: true, posts: likedJobs,count: { totalPage: totalPages, currentPageSize: likedJobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more resell tickets found',posts:[] ,count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.otherResellEvents = async (req, res) => {
  const userId = req?.user?._id||""
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }
  let query={};

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  query.user = userId;
  query.remaining_tickets={ $gt : 0 }
  try {
    const likedJobs = await Resell.find(query).populate({
      path: 'event',
      populate: [
        { path: 'user', model: 'user' },
        { path: 'category', model: 'Category' },
        { path: 'likes', model: 'Like' },
        { path: 'coupon', model: 'Coupon' },
        { path: 'purchase_by', model: 'Purchase',options: { limit: 3 }, populate: [{ path: 'user', model: 'user' },]},
      ]
    }).sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await Resell.countDocuments(query);
      const totalPages = Math.ceil(totalCount / pageSize);
    

    if (likedJobs.length > 0) {
      for (let purchase of likedJobs) {
        purchase.event.TotalLikes=purchase.event.likes?.length
        purchase.event.likes=userId? Array.isArray(purchase.event.likes) && purchase.event.likes.some(like => like.user.toString() === userId.toString()):false
      }
      res.status(200).json({ success: true, posts: likedJobs,count: { totalPage: totalPages, currentPageSize: likedJobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more resell tickets found',posts:[] ,count: { totalPage: totalPages, currentPageSize: likedJobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.purchaseTicket = async (req, res) => {
  const userId = req.user._id;
  const eventId=req.params.id;

  try {
    const {tickets}=req.body;

    const findEvent = await Resell.findById(eventId).populate("user").populate("event").lean()

    if (Number(findEvent.remaining_tickets)==0) return res.status(404).json({ message: "Resell tickets are fully sold" });

    if (Number(tickets) > Number(findEvent.remaining_tickets)) return res.status(404).json({ message: "Only "+findEvent.remaining_tickets+" Resell tickets are remaining." });

    const post = new Purchase({
      user: userId,
      event:eventId,
      tickets:tickets,
      totalPrice:findEvent.totalPrice,
      tickets_type_sale:[{
        type:findEvent.tickets_type_sale[0].type,
        totalTicket:tickets
      }]
    })

    const purchase = await Purchase.findById(findEvent.purchaseTickets)
    purchase.resellticket = Number(purchase.resellticket) + Number(tickets)
    purchase.resellpurchases = { $addToSet : post._id };
    
    await purchase.save()

    await Resell.findByIdAndUpdate(eventId,{remaining_tickets:Number(findEvent.remaining_tickets) - Number(tickets),$addToSet:{resellTickets:post._id}})

    await sendNotification({
      user : userId,
      to_id : findEvent.user._id,
      description :  `Someone has purchased your resell ${tickets} tickets of your ${findEvent.event.name}`,
      type :'purchase',
      title :"New Resell Ticket Purchase",
      fcmtoken : findEvent.user?.fcmtoken,
      event:eventId,
      purchase:post._id
  })
    
    await post.save();
    res.status(201).json({ success: true, message: 'Ticket purchase successfully', ticket:post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};