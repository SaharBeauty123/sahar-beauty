const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,  // בדקות
    required: true,
    default: 30
  },
  depositAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("Service", serviceSchema);
