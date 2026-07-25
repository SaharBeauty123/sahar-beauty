const Appointment = require('../models/Appointment');
const whatsappService = require('../services/whatsappService');
const { WAZE_URL, withWhatsAppFooter } = require('../utils/whatsappMessage');
const { formatJerusalemDate } = require('../utils/timeZone');
const { approveAndRequestDeposit } = require('../services/depositApprovalService');

const OWNER_WHATSAPP_PHONE = process.env.OWNER_WHATSAPP_PHONE || '0527881172';

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = String(time).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + Number(minutesToAdd || 0);
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function getPayload(reqBody) {
  return reqBody?.payload || reqBody?.data || reqBody || {};
}

function extractText(reqBody) {
  const payload = getPayload(reqBody);

  const candidates = [
    payload.body,
    payload.text,
    payload.text?.body,
    payload.message?.body,
    payload.message?.text,
    payload._data?.body,
    reqBody?.body,
    reqBody?.text
  ];

  const value = candidates.find((candidate) => typeof candidate === 'string');
  return String(value || '').trim();
}

function extractSender(reqBody) {
  const payload = getPayload(reqBody);

  const candidates = [
    payload.from,
    payload.sender,
    payload.chatId,
    payload.key?.remoteJid,
    payload._data?.from,
    payload._data?.id?.remote,
    reqBody?.from,
    reqBody?.sender
  ];

  const value = candidates.find((candidate) => typeof candidate === 'string');
  return String(value || '').split('@')[0];
}

function isFromMe(reqBody) {
  const payload = getPayload(reqBody);
  return Boolean(
    payload.fromMe === true ||
    payload.key?.fromMe === true ||
    payload._data?.id?.fromMe === true ||
    reqBody?.fromMe === true
  );
}

function isMessageEvent(reqBody) {
  const event = String(reqBody?.event || reqBody?.type || '').toLowerCase();
  if (!event) return true;
  return event.includes('message');
}

function isOwner(sender) {
  if (!sender) return false;
  return whatsappService.normalizePhone(sender) === whatsappService.normalizePhone(OWNER_WHATSAPP_PHONE);
}

async function notifyClient(appointment, approved) {
  const message = approved
    ? withWhatsAppFooter(
      `היי ${appointment.customerName} 🌸\nהתור שלך אושר סופית ✅\n\n📅 ${formatJerusalemDate(new Date(appointment.date))}\n🕐 ${appointment.time}–${addMinutesToTime(appointment.time, appointment.duration)}\n💄 ${appointment.service}\n\n📍 Waze: ${WAZE_URL}\n\nמחכות לך 🤎`
    )
    : withWhatsAppFooter(
      `היי ${appointment.customerName} אהובה 🌸\n\nלצערנו לא נוכל לאשר את בקשת התור במועד שבחרת.\n\n📅 תאריך: ${formatJerusalemDate(new Date(appointment.date))}\n🕐 שעת הגעה: ${appointment.time}\n🏁 שעת סיום: ${addMinutesToTime(appointment.time, appointment.duration)}\n💄 טיפול: ${appointment.service}\n\nנשמח שתבחרי מועד אחר שמתאים לך. אנחנו כאן כדי למצוא עבורך זמן מושלם 🤍`
    );

  return whatsappService.sendMessage(appointment.customerPhone, message);
}

exports.handleWahaWebhook = async (req, res) => {
  try {
    // Acknowledge non-message events so WAHA does not retry them unnecessarily.
    if (!isMessageEvent(req.body) || isFromMe(req.body)) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const sender = extractSender(req.body);
    const text = extractText(req.body);

    if (!isOwner(sender)) {
      return res.status(200).json({ success: true, ignored: true, reason: 'not-owner' });
    }

    if (text !== '1' && text !== '2') {
      return res.status(200).json({ success: true, ignored: true, reason: 'unsupported-reply' });
    }

    const appointment = await Appointment.findOne({
      status: 'pending',
      approvalRequestedAt: { $ne: null }
    }).sort({ approvalRequestedAt: 1, createdAt: 1 });

    if (!appointment) {
      await whatsappService.sendMessage(
        OWNER_WHATSAPP_PHONE,
        withWhatsAppFooter('אין כרגע בקשות תור שממתינות לאישור.')
      );

      return res.status(200).json({ success: true, processed: false, reason: 'no-pending-appointment' });
    }

    const approved = text === '1';
    const newStatus = approved ? 'awaiting-deposit' : 'cancelled';
    const decision = approved ? 'approved' : 'rejected';

    // Atomic update prevents duplicate webhook deliveries from deciding twice.
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: 'pending' },
      {
        $set: {
          status: newStatus,
          approvalDecision: decision,
          approvalDecisionAt: new Date(),
          clientReminderSent: false,
          ownerReminderSent: false,
          upcomingEmailSent: false
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(200).json({ success: true, processed: false, reason: 'already-processed' });
    }

    if (approved) {
      await approveAndRequestDeposit(updated);
    } else {
      await notifyClient(updated, false);
    }

    const requestCode = String(updated._id).slice(-6).toUpperCase();
    await whatsappService.sendMessage(
      OWNER_WHATSAPP_PHONE,
      withWhatsAppFooter(
        approved
          ? `✅ בקשת התור ${requestCode} אושרה.\n${updated.customerName} קיבלה קישור לתשלום הערבון.`
          : `❌ בקשת התור ${requestCode} נדחתה.\n${updated.customerName} קיבלה הודעת דחייה.`
      )
    );

    return res.status(200).json({
      success: true,
      processed: true,
      appointmentId: updated._id,
      status: updated.status
    });
  } catch (error) {
    console.error('❌ WAHA approval webhook error:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
};
