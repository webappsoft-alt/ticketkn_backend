const mongoose = require('mongoose');


const availableObj={
  name:String,
  image:String,
  day: {
    type: String,
    default: 'Mon',
    enum: ['Mon', 'Tue', "Wed",'Thu','Fri','Sat','Sun']
  },
  status:{
    type: Boolean,
    default: false
  },
}

const productSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  name: String,
  description: String,
  image: String,
  numb_exercise: String,
  time: String,
  amount: String,
  days:[availableObj],
  createdAt: { type: Date, default: Date.now, index: true }, // Timestamp for post creation
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'deleted']
  },
  type: {
    type: String,
    default: 'free',
    enum: ['free', 'paid']
  },
});

module.exports = mongoose.model('Program', productSchema);
