const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const whatsappService = require('../services/whatsappService');
const { WAZE_URL, withWhatsAppFooter } = require('../utils/whatsappMessage');
const { approveAndRequestDeposit } = require('../services/depositApprovalService');
const {
  jerusalemDateTimeToUtc,
  getAppointmentInstant,
  getJerusalemDateString,
  formatJerusalemDate
} = require('../utils/timeZone');

const ALLOWED_STATUSES = ['pending', 'awaiting-deposit', 'confirmed', 'cancelled', 'completed', 'no-show'];
const STATUS_LABELS = {
  pending: 'ממתין לאישור',
  'awaiting-deposit': 'ממתין לתשלום ערבון',
  confirmed: 'אושר',
  cancelled: 'בוטל',
  completed: 'הושלם',
  'no-show': 'לא הגיעה'
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = String(time).split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + Number(minutesToAdd || 0);
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function getMinutesBetween(startTime, endTime) {
  const [startHours, startMinutes] = String(startTime).split(':').map(Number);
  const [endHours, endMinutes] = String(endTime).split(':').map(Number);
  return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

function buildChangeList(previous, next) {
  const changes = [];

  if (previous.customerName !== next.customerName) {
    changes.push(`👤 שם: ${next.customerName}`);
  }

  if (previous.service !== next.service) {
    changes.push(`💄 טיפול: ${next.service}`);
  }

  if (previous.date !== next.date) {
    changes.push(`📅 תאריך: ${next.formattedDate}`);
  }

  if (previous.time !== next.time) {
    changes.push(`🕐 שעת הגעה: ${next.time}`);
  }

  if (previous.endTime !== next.endTime) {
    changes.push(`🏁 שעת סיום: ${next.endTime}`);
  }

  if (previous.status !== next.status) {
    changes.push(`📌 סטטוס: ${getStatusLabel(next.status)}`);
  }

  return changes;
}

function buildOwnerNoteSection(notes) {
  const cleanNote = String(notes || '').trim();

  if (!cleanNote) {
    return '';
  }

  return `\n\n📝 *הערה*:\n${cleanNote}`;
}

function buildClientUpdateMessage(appointment, changes, previousStatus) {
  const noteSection = buildOwnerNoteSection(appointment.notes);

  if (previousStatus === 'pending' && appointment.status === 'confirmed') {
    return withWhatsAppFooter(
      `היי ${appointment.customerName} 🌸\nהתור שלך אושר סופית ✅\n\n📅 ${formatJerusalemDate(new Date(appointment.date))}\n🕐 ${appointment.time}–${addMinutesToTime(appointment.time, appointment.duration)}\n💄 ${appointment.service}${noteSection}\n\n📍 Waze: ${WAZE_URL}\n\nמחכות לך 🤎`
    );
  }

  if (appointment.status === 'confirmed') {
    return withWhatsAppFooter(
      `היי ${appointment.customerName} 🌸\nהתור שלך אושר סופית ✅\n\n📅 ${formatJerusalemDate(new Date(appointment.date))}\n🕐 ${appointment.time}–${addMinutesToTime(appointment.time, appointment.duration)}\n💄 ${appointment.service}${noteSection}\n\n📍 Waze: ${WAZE_URL}\n\nמחכות לך 🤎`
    );
  }

  if (previousStatus === 'pending' && appointment.status === 'cancelled') {
    const reason = String(appointment.notes || '').trim();
    const reasonSection = reason ? `\n\n📝 סיבת הדחייה: ${reason}` : '';
    return withWhatsAppFooter(
      `היי ${appointment.customerName} אהובה 🌸\n\nלצערנו לא נוכל לאשר את בקשת התור במועד שבחרת.\n\n📅 תאריך: ${formatJerusalemDate(new Date(appointment.date))}\n🕐 שעת הגעה: ${appointment.time}\n🏁 שעת סיום: ${addMinutesToTime(appointment.time, appointment.duration)}\n💄 טיפול: ${appointment.service}${reasonSection}\n\nנשמח שתבחרי מועד אחר שמתאים לך, ונעשה הכול כדי למצוא עבורך זמן מושלם 🤍`
    );
  }

  if (appointment.status === 'cancelled') {
    return withWhatsAppFooter(
      `היי ${appointment.customerName} אהובה 🌸\n\nרצינו לעדכן שהתור שלך ב-Sahar Beauty בוטל.\n\n📅 תאריך: ${formatJerusalemDate(new Date(appointment.date))}\n🕐 שעת הגעה: ${appointment.time}\n🏁 שעת סיום: ${addMinutesToTime(appointment.time, appointment.duration)}\n💄 טיפול: ${appointment.service}${noteSection}\n\nאנחנו כאן עבורך ונשמח לעזור לך לבחור מועד חדש 🤍`
    );
  }

  return withWhatsAppFooter(
    `היי ${appointment.customerName} אהובה 🌸\n\nעדכנו עבורך את פרטי התור ב-Sahar Beauty ✨\n\nמה השתנה:\n${changes.join('\n')}\n\nפרטי התור המעודכנים:\n📅 תאריך: ${formatJerusalemDate(new Date(appointment.date))}\n🕐 שעת הגעה: ${appointment.time}\n🏁 שעת סיום: ${addMinutesToTime(appointment.time, appointment.duration)}\n💄 טיפול: ${appointment.service}\n⏳ משך הטיפול: ${appointment.duration} דקות\n📌 סטטוס: ${getStatusLabel(appointment.status)}${noteSection}\n\nכדאי לשמור את ההודעה. מחכות לך לחוויה יפה ורגועה 🤍`
  );
}

exports.updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'התור לא נמצא' });
    }

    const previous = {
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      service: appointment.service,
      date: getJerusalemDateString(new Date(appointment.date)),
      time: appointment.time,
      endTime: addMinutesToTime(appointment.time, appointment.duration),
      duration: Number(appointment.duration),
      status: appointment.status,
      notes: appointment.notes || ''
    };

    const customerName = String(req.body.customerName ?? appointment.customerName).trim();
    const customerPhone = String(req.body.customerPhone ?? appointment.customerPhone).replace(/\D/g, '');
    const service = String(req.body.service ?? appointment.service).trim();
    const time = String(req.body.time ?? appointment.time).trim();
    const endTime = String(
      req.body.endTime ?? addMinutesToTime(appointment.time, appointment.duration)
    ).trim();
    let status = String(req.body.status ?? appointment.status);
    if (appointment.status === 'pending' && status === 'confirmed') {
      status = 'awaiting-deposit';
    }
    const notes = String(req.body.notes ?? appointment.notes ?? '').trim();

    let dateString = req.body.date;
    if (!dateString) {
      dateString = getJerusalemDateString(new Date(appointment.date));
    }

    const duration = getMinutesBetween(time, endTime);

    if (!customerName || !/^05\d{8}$/.test(customerPhone)) {
      return res.status(400).json({ success: false, error: 'שם או מספר טלפון לא תקינים' });
    }

    if (!/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(time) || !/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      return res.status(400).json({ success: false, error: 'שעת הגעה או שעת סיום לא תקינה' });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'סטטוס לא תקין' });
    }

    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      return res.status(400).json({ success: false, error: 'משך התור חייב להיות בין 5 ל-480 דקות' });
    }

    if (notes.length > 500) {
      return res.status(400).json({ success: false, error: 'ההערה ארוכה מדי' });
    }

    const serviceDoc = await Service.findOne({ name: service });
    if (!serviceDoc) {
      return res.status(400).json({ success: false, error: 'השירות לא נמצא' });
    }

    const newStart = jerusalemDateTimeToUtc(dateString, time);
    if (Number.isNaN(newStart.getTime())) {
      return res.status(400).json({ success: false, error: 'תאריך או שעה לא תקינים' });
    }

    const newEnd = new Date(newStart.getTime() + duration * 60000);

    if (status !== 'cancelled') {
      const nearbyAppointments = await Appointment.find({
        _id: { $ne: appointment._id },
        status: { $ne: 'cancelled' },
        date: {
          $gte: new Date(newStart.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(newStart.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      const conflict = nearbyAppointments.find((other) => {
        const otherStart = getAppointmentInstant(other);
        const otherEnd = new Date(otherStart.getTime() + (Number(other.duration) || 30) * 60000);
        return newStart < otherEnd && newEnd > otherStart;
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          error: `התור מתנגש עם תור של ${conflict.customerName} בשעה ${conflict.time}`
        });
      }
    }

    const next = {
      customerName,
      customerPhone,
      service,
      date: dateString,
      formattedDate: formatJerusalemDate(newStart),
      time,
      endTime,
      duration,
      status,
      notes
    };

    const changes = buildChangeList(previous, next);
    const phoneChanged = previous.customerPhone !== customerPhone;
    const notesChanged = previous.notes !== next.notes;
    const hasMeaningfulChanges = changes.length > 0 || phoneChanged || notesChanged;

    const scheduleChanged =
      previous.time !== time ||
      previous.duration !== duration ||
      previous.date !== dateString;

    appointment.customerName = customerName;
    appointment.customerPhone = customerPhone;
    appointment.service = service;
    appointment.duration = duration;
    appointment.date = newStart;
    appointment.time = time;
    appointment.status = status;
    appointment.notes = notes;

    const approvalHandled = previous.status === 'pending' && status === 'awaiting-deposit';

    if (approvalHandled) {
      appointment.approvalDecision = 'approved';
      appointment.approvalDecisionAt = new Date();
    } else if (previous.status === 'pending' && status === 'cancelled') {
      appointment.approvalDecision = 'rejected';
      appointment.approvalDecisionAt = new Date();
    }

    if (scheduleChanged) {
      appointment.clientReminderSent = false;
      appointment.ownerReminderSent = false;
      appointment.upcomingEmailSent = false;
    }

    let approvalResult = null;
    if (approvalHandled) {
      approvalResult = await approveAndRequestDeposit(appointment);
    } else {
      await appointment.save();
    }

    let whatsappNotificationSent = false;
    let whatsappNotificationError = null;

    if (approvalHandled) {
      whatsappNotificationSent = approvalResult?.whatsappSent === true;
    } else if (hasMeaningfulChanges) {
      try {
        const messageChanges = changes.length > 0
          ? changes
          : ['ℹ️ פרטי התור עודכנו על ידי העסק'];

        await whatsappService.sendMessage(
          appointment.customerPhone,
          buildClientUpdateMessage(appointment, messageChanges, previous.status)
        );

        whatsappNotificationSent = true;
        console.log(`✅ Appointment update WhatsApp sent to ${appointment.customerName}`);
      } catch (error) {
        whatsappNotificationError = error.message;
        console.error(
          `❌ Appointment update WhatsApp failed for ${appointment.customerName}:`,
          error.message
        );
      }
    }

    return res.json({
      success: true,
      data: appointment,
      whatsappNotificationSent,
      whatsappNotificationError
    });
  } catch (error) {
    console.error('Appointment update error:', error);
    return res.status(500).json({ success: false, error: 'שגיאה בעדכון התור' });
  }
};
