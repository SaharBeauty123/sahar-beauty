const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect } = require('../middleware/authMiddleware');

/* GET ALL SERVICES */
router.get('/', async (req, res) => {
  const services = await Service.find();
  res.json(services);
});

/* ADD SERVICE */
router.post("/", protect, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const price = Number(req.body.price);
  const duration = Number(req.body.duration);
  const depositAmount = Number(req.body.depositAmount);

  if (
    !name ||
    !Number.isFinite(price) || price < 0 ||
    !Number.isFinite(duration) || duration < 1 ||
    !Number.isFinite(depositAmount) || depositAmount < 0
  ) {
    return res.status(400).json({ error: 'יש להזין שם, מחיר, משך וסכום ערבון תקינים' });
  }

  const service = await Service.create({
    name,
    price,
    duration,
    depositAmount
  });

  res.status(201).json(service);
});

/* UPDATE SERVICE */
router.put('/:id', protect, async (req, res) => {
  const price = Number(req.body.price);
  const duration = Number(req.body.duration);
  const depositAmount = Number(req.body.depositAmount);

  if (
    !Number.isFinite(price) || price < 0 ||
    !Number.isFinite(duration) || duration < 1 ||
    !Number.isFinite(depositAmount) || depositAmount < 0
  ) {
    return res.status(400).json({ error: 'מחיר, משך וסכום ערבון חייבים להיות תקינים' });
  }

  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { $set: { price, duration, depositAmount } },
    { new: true, runValidators: true }
  );

  if (!service) {
    return res.status(404).json({ error: 'השירות לא נמצא' });
  }

  res.json(service);
});

/* DELETE SERVICE */
router.delete('/:id', protect, async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
