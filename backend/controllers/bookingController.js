const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const BusinessSettings = require('../models/BusinessSettings');
const PhoneVerification = require('../models/PhoneVerification');
const whatsappService = require('../services/whatsappService');
const { WAZE_URL, withWhatsAppFooter } = require('../utils/whatsappMessage');
const { hashToken } = require('../services/depositApprovalService');
const {
  jerusalemDateTimeToUtc,
  formatJerusalemDate,
  getAppointmentInstant
} = require('../utils/timeZone');

const OWNER_WHATSAPP_PHONE = process.env.OWNER_WHATSAPP_PHONE || '0527881172';
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'development-only-secret');
const BANK_TRANSFER_DETAILS = process.env.BANK_TRANSFER_DETAILS
  || 'פרטי חשבון הבנק טרם הוגדרו';

function getDayKey(dateString) {
  const dayMap = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];

  const calendarDate = new Date(`${dateString}T12:00:00Z`);
  return dayMap[calendarDate.getUTCDay()];
}

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = String(time).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + Number(minutesToAdd || 0);
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

function getMinutesBetween(startTime, endTime) {
  const [startHours, startMinutes] = String(startTime).split(':').map(Number);
  const [endHours, endMinutes] = String(endTime).split(':').map(Number);
  return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

function isAuthenticatedAdmin(req) {
  try {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return false;

    const token = authorization.slice(7).trim();
    if (!token) return false;

    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

async function sendAndTrack(phone, message) {
  const result = await whatsappService.sendMessage(phone, message);
  return result?.success === true;
}

async function consumePhoneVerification(phone, token) {
  if (!token) return false;
  const verification = await PhoneVerification.findOneAndUpdate(
    {
      phone,
      verifiedTokenHash: crypto.createHash('sha256').update(String(token)).digest('hex'),
      verifiedUntil: { $gt: new Date() },
      consumedAt: null
    },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );
  return Boolean(verification);
}

exports.createAppointment = async (req, res) => {
  try {
    const { customerName, customerPhone, service, date, time, endTime, verificationToken } = req.body;
    const createdByAdmin = isAuthenticatedAdmin(req);

    if (!customerName || !customerPhone || !service || !date || !endTime || (createdByAdmin && !time)) {
      return res.status(400).json({
        success: false,
        error: 'כל השדות הם חובה'
      });
    }

    const serviceDoc = await Service.findOne({ name: service });
    if (!serviceDoc) {
      return res.status(400).json({
        success: false,
        error: 'השירות המבוקש לא נמצא'
      });
    }

    if (!/^05\d{8}$/.test(customerPhone)) {
      return res.status(400).json({
        success: false,
        error: 'מספר טלפון לא תקין (05XXXXXXXX)'
      });
    }

    const serviceDuration = Number(serviceDoc.duration) || 30;
    const startTime = createdByAdmin
      ? String(time)
      : addMinutesToTime(endTime, -serviceDuration);
    const duration = createdByAdmin
      ? getMinutesBetween(startTime, endTime)
      : serviceDuration;

    if (
      !/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(String(endTime)) ||
      !Number.isFinite(duration) || duration < 5 || duration > 480
    ) {
      return res.status(400).json({
        success: false,
        error: 'שעת הגעה או שעת סיום לא תקינה'
      });
    }

    const appointmentDateTime = jerusalemDateTimeToUtc(date, startTime);

    if (Number.isNaN(appointmentDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'תאריך או שעה לא תקינים'
      });
    }

    if (appointmentDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'לא ניתן לקבוע תור לזמן שעבר'
      });
    }

    const requestedEnd = jerusalemDateTimeToUtc(date, endTime);

    const settings = await BusinessSettings.findOne();
    const daySettings = settings?.workingHours?.[getDayKey(date)];
    const depositAmount = Math.max(0, Number(serviceDoc.depositAmount) || 0);

    if (!daySettings || !daySettings.enabled) {
      return res.status(400).json({
        success: false,
        error: 'העסק סגור ביום שנבחר'
      });
    }

    const workStart = jerusalemDateTimeToUtc(date, daySettings.start);
    const workEnd = jerusalemDateTimeToUtc(date, daySettings.end);

    if (appointmentDateTime < workStart || requestedEnd > workEnd) {
      return res.status(400).json({
        success: false,
        error: 'התור חייב להתחיל ולהסתיים בתוך שעות הפעילות'
      });
    }

    const breakConflict = (daySettings.breaks || []).some((breakItem) => {
      const breakStart = jerusalemDateTimeToUtc(date, breakItem.start);
      const breakEnd = jerusalemDateTimeToUtc(date, breakItem.end);
      return appointmentDateTime < breakEnd && requestedEnd > breakStart;
    });

    if (breakConflict) {
      return res.status(409).json({
        success: false,
        error: 'השעה שנבחרה נמצאת בזמן הפסקה'
      });
    }

    const dayStart = jerusalemDateTimeToUtc(date, '00:00');
    const dayEnd = jerusalemDateTimeToUtc(date, '23:59');
    dayEnd.setSeconds(59, 999);

    const existingAppointments = await Appointment.find({
      date: { $gte: dayStart, $lte: dayEnd },
      status: { $ne: 'cancelled' }
    });

    const hasConflict = existingAppointments.some((existing) => {
      const existingStart = getAppointmentInstant(existing);
      const existingEnd = new Date(
        existingStart.getTime() + (Number(existing.duration) || 30) * 60000
      );

      return appointmentDateTime < existingEnd && requestedEnd > existingStart;
    });

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'השעה שנבחרה אינה פנויה'
      });
    }

    if (!createdByAdmin && !(await consumePhoneVerification(customerPhone, verificationToken))) {
      return res.status(401).json({
        success: false,
        error: 'יש לאמת את מספר הטלפון לפני קביעת התור'
      });
    }

    const initialStatus = createdByAdmin ? 'confirmed' : 'pending';
    const now = new Date();

    const appointment = await Appointment.create({
      customerName: String(customerName).trim(),
      customerPhone,
      service,
      duration,
      date: appointmentDateTime,
      time: startTime,
      depositAmount,
      status: initialStatus,
      approvalRequestedAt: createdByAdmin ? null : now,
      approvalDecisionAt: createdByAdmin ? now : null,
      approvalDecision: createdByAdmin ? 'approved' : null,
      clientReminderSent: false,
      ownerReminderSent: false,
      upcomingEmailSent: false
    });

    const appointmentEndTime = String(endTime);

    res.status(201).json({
      success: true,
      message: createdByAdmin
        ? 'התור נקבע ואושר בהצלחה!'
        : 'בקשת התור נשלחה וממתינה לאישור Sahar Beauty',
      data: appointment
    });

    if (createdByAdmin) {
      const confirmationMessage = withWhatsAppFooter(
        `היי ${appointment.customerName} 🌸\nהתור שלך אושר סופית ✅\n\n📅 ${formatJerusalemDate(appointmentDateTime)}\n🕐 ${appointment.time}–${appointmentEndTime}\n💄 ${appointment.service}\n\n📍 Waze: ${WAZE_URL}\n\nמחכות לך 🤎`
      );

      sendAndTrack(appointment.customerPhone, confirmationMessage)
        .then((sent) => sent && Appointment.updateOne(
          { _id: appointment._id },
          { $set: { clientBookingNotificationSent: true } }
        ))
        .catch((error) => {
          console.error('❌ Manual booking confirmation WhatsApp failed:', error.message);
        });

      return;
    }

    const requestCode = String(appointment._id).slice(-6).toUpperCase();

    const waitingMessage = withWhatsAppFooter(
      `היי ${appointment.customerName} 🌸\nבקשתך התקבלה ב-Sahar Beauty.\n\n📅 ${formatJerusalemDate(appointmentDateTime)}\n🕐 ${appointment.time}–${appointmentEndTime}\n💄 ${appointment.service}\n\nנעדכן אותך לאחר האישור 🤎`
    );

    const ownerApprovalMessage = withWhatsAppFooter(
      `📅 בקשת תור חדשה ממתינה לאישור\n\n🔢 מספר בקשה: ${requestCode}\n👤 שם: ${appointment.customerName}\n📞 טלפון: ${appointment.customerPhone}\n✨ שירות: ${appointment.service}\n⏳ משך: ${appointment.duration} דקות\n📅 תאריך: ${formatJerusalemDate(appointmentDateTime)}\n🕐 התחלה: ${appointment.time}\n🏁 סיום: ${appointmentEndTime}\n\nהשב 1 כדי לאשר את התור ✅\nהשב 2 כדי לדחות את התור ❌\n\nהתגובה תחול על בקשת התור הממתינה הוותיקה ביותר.`
    );

    Promise.all([
      sendAndTrack(appointment.customerPhone, waitingMessage)
        .then((sent) => sent && Appointment.updateOne(
          { _id: appointment._id },
          { $set: { clientBookingNotificationSent: true } }
        )),
      sendAndTrack(OWNER_WHATSAPP_PHONE, ownerApprovalMessage)
        .then((sent) => sent && Appointment.updateOne(
          { _id: appointment._id },
          { $set: { ownerBookingNotificationSent: true } }
        ))
    ]).catch((error) => {
      console.error('❌ Booking approval notification failed:', error.message);
    });
  } catch (error) {
    console.error('שגיאה ביצירת תור:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'שגיאת שרת פנימית'
      });
    }
  }
};

exports.selectDepositMethod = async (req, res) => {
  try {
    const method = String(req.body.method || '');

    if (!['bit', 'bank-transfer', 'cash'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'אמצעי התשלום אינו נתמך'
      });
    }

    const tokenHash = hashToken(req.body.token || '');
    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'awaiting-deposit',
        depositPaymentTokenHash: tokenHash
      },
      { $set: {
        depositStatus: method === 'cash' ? 'cash-coordination' : 'proof-pending',
        depositMethod: method,
      } },
      { new: true, runValidators: true }
    ).select('+depositPaymentTokenHash');

    if (!appointment) {
      return res.status(400).json({ success: false, error: 'קישור התשלום אינו תקין או שהתור טרם אושר' });
    }

    if (method === 'bank-transfer') {
      const bankMessage = withWhatsAppFooter(
        `היי ${appointment.customerName} 🌸\nאלו פרטי חשבון הבנק להעברת הערבון בסך ₪${appointment.depositAmount}:\n\n${BANK_TRANSFER_DETAILS}\n\nלאחר ההעברה, צלמי מסך ושלחי את האסמכתא ל-WhatsApp של Sahar Beauty.\nהתור יאושר סופית לאחר בדיקת האסמכתא.`
      );
      await sendAndTrack(appointment.customerPhone, bankMessage);
    }

    return res.json({
      success: true,
      message: method === 'bank-transfer'
        ? 'פרטי חשבון הבנק נשלחים אלייך ב-WhatsApp'
        : 'אמצעי התשלום נשמר. התור ממתין לבדיקת התשלום.',
      data: {
        status: appointment.status,
        depositStatus: appointment.depositStatus,
        depositMethod: appointment.depositMethod
      }
    });
  } catch (error) {
    console.error('שגיאה בבחירת אמצעי תשלום:', error);
    res.status(500).json({ success: false, error: 'שגיאה בבחירת אמצעי התשלום' });
  }
};

exports.getDepositPaymentDetails = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      status: 'awaiting-deposit',
      depositPaymentTokenHash: hashToken(req.query.token || '')
    }).select('+depositPaymentTokenHash');

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'קישור התשלום אינו תקין או שפג תוקפו' });
    }

    return res.json({
      success: true,
      data: {
        id: appointment._id,
        customerName: appointment.customerName,
        service: appointment.service,
        date: appointment.date,
        time: appointment.time,
        endTime: addMinutesToTime(appointment.time, appointment.duration),
        amount: appointment.depositAmount
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'שגיאה בטעינת פרטי התשלום' });
  }
};
