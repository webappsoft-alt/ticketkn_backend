const mongoose = require('mongoose');

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
  price: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    default: 'general',
    enum: ['general', 'vip', 'vvip', 'earlybird']
  },
  purchase_ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  resellTickets: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidDate: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Resell', productSchema);
