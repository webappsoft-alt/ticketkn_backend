const Coupon = require('../models/Coupon');
const Event = require('../models/Event');

exports.create = async (req, res) => {
  try {
    const userId=req.user._id
    const { events, title,code,expirey_date,discount } = req.body;
    const category = new Coupon({
      user:userId,
      events, title,code,expirey_date,discount
    });
    await category.save();
    for (let event of events) {
      await Event.findByIdAndUpdate(event,{coupon:true},{new:true})
    }

    res.status(201).json({ success: true, message: 'Coupon created successfully', category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.editCategories = async (req, res) => {
  try {
    const serviceId = req.params.id;

    const { events, title,code,expirey_date,discount } = req.body;


    // Create an object to store the fields to be updated
  const updateFields = Object.fromEntries(
    Object.entries({
      events, title,code,expirey_date,discount 
    }).filter(([key, value]) => value !== undefined)
  );

  // Check if there are any fields to update
  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .send({
        success: false,
        message: "No valid fields provided for update.",
      });
  }

  if (events) { 
    const coupon=await Coupon.findById(serviceId).lean()

    if (coupon == null) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    for (let event of coupon.events) {
      await Event.findByIdAndUpdate(event,{coupon:false},{new:true})
    }
  }
  
  const service = await Coupon.findOneAndUpdate(
    { _id: serviceId },
    updateFields,
    { new: true }
  );
  
  if (service == null) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  if (events) {     
    for (let event of events) {
      await Event.findByIdAndUpdate(event,{coupon:true},{new:true})
    }
  }

    res.status(200).json({ message: `Coupon updated successfully`, Coupon: service });

  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyCoupons = async (req, res) => {
  let query = {};
  const userId=req.user._id

  if (req.params.id) {
    query._id = { $lt: req.params.id };
  }
  query.user = userId
  try {
    const categories = await Coupon.find(query).sort({ _id: -1 }).lean();


    if (categories.length > 0) {
      res.status(200).json({ success: true, coupones: categories });
    } else {
      res.status(200).json({ success: false,coupones:[], message: 'No more coupones found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteCoupons = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId=req.user._id

    const service = await Coupon.findOneAndDelete({ _id: serviceId,user:userId });

    if (service == null) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    for (let event of service.events) {
      await Event.findByIdAndUpdate(event,{coupon:false},{new:true})
    }

    res.status(200).json({ message: `Coupon deleted successfully`, Coupon: service });

  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};