const express = require('express');
const Feedback = require('../models/Feedback');

const router = express.Router();

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

router.get('/', async (req, res, next) => {
  try {
    const feedback = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .select('name rating message createdAt')
      .lean();
    res.json(feedback);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = normalizeText(req.body.name);
    const message = normalizeText(req.body.message);
    const rating = Number(req.body.rating);

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: 'Name must contain 2–60 characters' });
    }
    if (message.length < 5 || message.length > 600) {
      return res.status(400).json({ error: 'Feedback must contain 5–600 characters' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const feedback = await Feedback.create({ name, rating, message });
    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
