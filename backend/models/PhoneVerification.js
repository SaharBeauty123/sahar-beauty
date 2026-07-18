const mongoose = require('mongoose');

const phoneVerificationSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0 },
  verifiedTokenHash: { type: String, default: null },
  verifiedUntil: { type: Date, default: null },
  consumedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PhoneVerification', phoneVerificationSchema);
