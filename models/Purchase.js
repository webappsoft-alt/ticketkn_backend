const mongoose = require('mongoose');

const joinUserSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  tickets: {
    type:Number,
    default:0
  },
  totalPrice: {
    type:Number,
    default:0
  },
  createdAt: { type: Date, default: Date.now, index: true }, // Timestamp for post creation
});

module.exports = mongoose.model('Purchase', joinUserSchema);