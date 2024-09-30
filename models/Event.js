const mongoose = require('mongoose');


const ticketPlanObj={
  type:{
    type: String,
    default: 'general',
    enum: ['general', 'vip','vvip']
  },
  price:{
    type: Number,
    default: 0,
  },
  totalTicket:{
    type: Number,
    default: 0,
  },
  offers:[{
    id:String,
    title:String,
  }]
}

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  images: [String],
  name: String,
  event_type: String,
  start_Date: Date,
  start_Time: Date,
  address:String,
  country:String,
  city:String,
  state:String,
  description: String,
  join_people: {
    type:Number,
    default:0
  },
  ticket_plans: [ticketPlanObj],
  refund_policy:String,
  category:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Like' }], // Reference to likes
  purchase_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }], // Reference to likes
  createdAt: { type: Date, default: Date.now, index: true }, // Timestamp for post creation
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'deleted']
  },
});

postSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Event', postSchema);
