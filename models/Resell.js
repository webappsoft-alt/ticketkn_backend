const mongoose = require('mongoose');

const ticketObj={
  type:{
    type: String,
    default: 'general',
    enum:['general', 'vip','vvip','earlybird']
  },
  totalTicket:{
    type: Number,
    default: 0,
  },
  total_price:{
    type: Number,
    default: 0,
  }
}

const productSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  tickets_type_sale:[ticketObj],
  remaining_tickets: {
    type:Number,
    default:0
  },
  purchase_ticketId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  resellTickets:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
  }],
  createdAt: { type: Date, default: Date.now, index: true }, // Timestamp for post creation

});

module.exports = mongoose.model('Resell', productSchema);
