const crypto = require('crypto');
const whatsappService = require('./whatsappService');
const { withWhatsAppFooter } = require('../utils/whatsappMessage');
const { formatJerusalemDate } = require('../utils/timeZone');

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = String(time).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + Number(minutesToAdd || 0);
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function approveAndRequestDeposit(appointment) {
  const token = crypto.randomBytes(32).toString('hex');
  appointment.status = 'awaiting-deposit';
  appointment.approvalDecision = 'approved';
  appointment.approvalDecisionAt = new Date();
  appointment.depositStatus = 'unpaid';
  appointment.depositPaymentTokenHash = hashToken(token);
  appointment.depositPaymentLinkSentAt = new Date();
  await appointment.save();

  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5500/frontend').replace(/\/+$/, '');
  const paymentLink = `${frontendUrl}/deposit.html?id=${encodeURIComponent(appointment._id)}&token=${encodeURIComponent(token)}`;
  const message = withWhatsAppFooter(
    `היי ${appointment.customerName} אהובה 🌸\n\nיש לנו בשורה משמחת — Sahar Beauty אישרה את בקשת התור שלך ✨\n\nכדי לשמור את הזמן במיוחד עבורך ולאשר את התור סופית, נותר לשלם ערבון בסך *₪${appointment.depositAmount}* באמצעות Bit:\n\n${paymentLink}\n\nפרטי התור שלך:\n📅 ${formatJerusalemDate(new Date(appointment.date))}\n🕐 שעת הגעה: ${appointment.time}\n🏁 שעת סיום: ${addMinutesToTime(appointment.time, appointment.duration)}\n💄 ${appointment.service}\n\nלאחר קליטת התשלום נשלח לך אישור סופי. מחכות להעניק לך חוויה יפה ומפנקת 🤍`
  );
  const result = await whatsappService.sendMessage(appointment.customerPhone, message);
  return { appointment, paymentLink, whatsappSent: result?.success === true };
}

module.exports = { approveAndRequestDeposit, hashToken };
