const crypto = require('crypto');
const express = require('express');
const PhoneVerification = require('../models/PhoneVerification');
const whatsappService = require('../services/whatsappService');
const { withWhatsAppFooter } = require('../utils/whatsappMessage');

const router = express.Router();
const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeLocalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^9725\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
}

router.post('/request', async (req, res, next) => {
  try {
    const phone = normalizeLocalPhone(req.body.phone);
    if (!/^05\d{8}$/.test(phone)) {
      return res.status(400).json({ error: 'מספר טלפון לא תקין' });
    }

    const recent = await PhoneVerification.findOne({
      phone,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
    });
    if (recent) {
      return res.status(429).json({ error: 'יש להמתין דקה לפני שליחת קוד נוסף' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    await PhoneVerification.create({
      phone,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS)
    });

    const result = await whatsappService.sendMessage(
      phone,
      withWhatsAppFooter(`היי יפה 🌸\n\nקוד האימות שלך לקביעת תור ב-Sahar Beauty הוא:\n\n*${code}*\n\nהקוד תקף ל-10 דקות ונועד עבורך בלבד. מיד לאחר האימות תוכלי להמשיך לבחירת התור שלך ✨`)
    );

    if (!result?.success) {
      return res.status(503).json({ error: 'לא ניתן לשלוח כרגע את קוד האימות ב-WhatsApp' });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const phone = normalizeLocalPhone(req.body.phone);
    const code = String(req.body.code || '').trim();
    const verification = await PhoneVerification.findOne({
      phone,
      consumedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!verification || verification.attempts >= 5 || hash(code) !== verification.codeHash) {
      if (verification) {
        verification.attempts += 1;
        await verification.save();
      }
      return res.status(400).json({ error: 'קוד האימות שגוי או שפג תוקפו' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    verification.verifiedTokenHash = hash(token);
    verification.verifiedUntil = new Date(Date.now() + TOKEN_TTL_MS);
    verification.expiresAt = verification.verifiedUntil;
    await verification.save();

    return res.json({ success: true, token });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
