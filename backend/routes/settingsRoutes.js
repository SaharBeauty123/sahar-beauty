const express = require("express");
const router = express.Router();
const BusinessSettings = require("../models/BusinessSettings");
const { protect } = require("../middleware/authMiddleware");

router.get("/", async (req,res)=>{
  const settings = await BusinessSettings.findOne();
  res.json(settings);
});

router.put("/", protect, async (req,res)=>{
  const update = {};

  if (req.body.workingHours) {
    update.workingHours = req.body.workingHours;
  }

  const settings = await BusinessSettings.findOneAndUpdate(
    {},
    { $set: update },
    { new:true, runValidators:true }
  );
  res.json(settings);
});

module.exports = router;
