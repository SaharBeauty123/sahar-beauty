const mongoose = require("mongoose");

const breakSchema = {
  start: String,
  end: String
};

const daySchema = {
  start: String,
  end: String,
  breaks: [breakSchema],   // ✅ מערך הפסקות
  enabled: Boolean
};

const businessSettingsSchema = new mongoose.Schema({
  workingHours: {
    sunday: daySchema,
    monday: daySchema,
    tuesday: daySchema,
    wednesday: daySchema,
    thursday: daySchema,
    friday: daySchema,
    saturday: daySchema
  }
});

module.exports = mongoose.model("BusinessSettings", businessSettingsSchema);
