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
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'accepted','rejected']
  },
  createdAt: { type: Date, default: Date.now, index: true }, // Timestamp for post creation
});

module.exports = mongoose.model('JoinUser', joinUserSchema);