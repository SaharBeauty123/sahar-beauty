// ✅ تم التحديث ليرتبط بسيرفر Railway الجديد 24/7
const API_URL = "http://localhost:5001/api";

/* ===============================
   DOM ELEMENTS
=================================*/
const bookingForm = document.getElementById("bookingForm");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const serviceSelect = document.getElementById("service");
const messageBox = document.getElementById("messageBox");
const priceDisplay = document.getElementById("servicePriceDisplay");

/* ===============================
   INIT AFTER DOM LOAD
=================================*/
document.addEventListener("DOMContentLoaded", () => {

  // 1. جلب الخدمات أولاً من قاعدة البيانات
  loadServices();

  // 2. إعداد مكتبة تحديد التاريخ Flatpickr
  if (typeof flatpickr !== "undefined" && dateInput) {
    flatpickr(dateInput, {
      locale: "he",
      dateFormat: "Y-m-d",
      minDate: "today",
      defaultDate: "today", 
      disableMobile: true,
      onReady: function(selectedDates, dateStr) {
        if (dateStr) {
          loadAvailableTimes(); 
        }
      },
      onChange: function(selectedDates, dateStr) {
        if (dateStr) {
          loadAvailableTimes();
        }
      }
    });
  }

  // 3. أحداث التغيير وإرسال الفورم
  if (serviceSelect) {
    serviceSelect.addEventListener("change", () => {
      showServicePrice();
      loadAvailableTimes(); // ✅ جلب الساعات فور اختيار الخدمة أو تغييرها
    });
  }

  // תמיכה בשני המצבים: גם אם הכפתור הוא type="submit" וגם אם קוראים לו ישירות מה-HTML
  if (bookingForm) {
    bookingForm.addEventListener("submit", submitBooking);
  }
});

/* ===============================
   LOAD SERVICES FROM DATABASE
=================================*/
async function loadServices() {
  if (!serviceSelect) return;
  try {
    const res = await fetch(`${API_URL}/services`);
    const services = await res.json();

    serviceSelect.innerHTML = '<option value="">בחר שירות...</option>';

    services.forEach(service => {
      const option = document.createElement("option");
      option.value = service.name;
      option.textContent = service.name;
      option.dataset.price = service.price;
      option.dataset.duration = service.duration;
      serviceSelect.appendChild(option);
    });

  } catch (error) {
    console.error("Error loading services:", error);
  }
}

/* ===============================
   SHOW PRICE WHEN SERVICE SELECTED
=================================*/
function showServicePrice() {
  if (!serviceSelect || !priceDisplay) return;
  const selected = serviceSelect.options[serviceSelect.selectedIndex];
  if (!selected) return;
  
  const price = selected.dataset.price;

  if (price) {
    priceDisplay.textContent = `מחיר: ₪${price}`;
  } else {
    priceDisplay.textContent = "";
  }
}

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + Number(minutesToAdd || 0);
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

/* ===============================
   LOAD AVAILABLE TIMES
=================================*/
async function loadAvailableTimes() {
  if (!dateInput || !serviceSelect || !timeSelect) return;
  
  const date = dateInput.value;
  const service = serviceSelect.value;

  // إذا لم يتم تحديد التاريخ والخدمة معاً، انتظر ولا تفعل شيئاً
  if (!date || !service) return;

  timeSelect.disabled = true;
  timeSelect.innerHTML = "<option>טוען...</option>";

  try {
    const res = await fetch(
      `${API_URL}/appointments/available/${date}?service=${encodeURIComponent(service)}`
    );

    const data = await res.json();
    timeSelect.innerHTML = "";

    if (!data.availableSlots || data.availableSlots.length === 0) {
      timeSelect.innerHTML = "<option>אין שעות פנויות</option>";
      timeSelect.disabled = true;
    } else {
      timeSelect.innerHTML = '<option value="">בחרי שעת סיום...</option>';

      const selectedService = serviceSelect.options[serviceSelect.selectedIndex];
      const serviceDuration = Number(selectedService?.dataset.duration) || 30;

      data.availableSlots.forEach(slot => {
        const endTime = addMinutesToTime(slot, serviceDuration);
        const option = document.createElement("option");
        // The backend keeps the calculated start time for conflict checks,
        // while the customer sees and chooses the desired end time.
        option.value = slot;
        option.dataset.endTime = endTime;
        option.textContent = endTime;
        timeSelect.appendChild(option);
      });

      timeSelect.disabled = false;
    }

  } catch (error) {
    console.error("Error loading available times:", error);
    timeSelect.innerHTML = "<option>שגיאה בטעינת השעות</option>";
  }
}

/* ===============================
   SUBMIT BOOKING
=================================*/
async function submitBooking(e) {
  // منع السلوك الافتراضي للفورم إذا تم استدعاؤه كـ submit event
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const nameEl = document.getElementById("name");
  const phoneEl = document.getElementById("phone");

  if (!nameEl || !phoneEl || !serviceSelect || !dateInput || !timeSelect) {
    console.error("Required form elements are missing from the DOM.");
    return;
  }

  const data = {
    customerName: nameEl.value.trim(),
    customerPhone: phoneEl.value.trim(),
    service: serviceSelect.value,
    date: dateInput.value,
    time: timeSelect.value,
    endTime: timeSelect.options[timeSelect.selectedIndex]?.dataset.endTime || ""
  };

  if (!data.customerName || !data.customerPhone || !data.service || !data.date || !data.time || !data.endTime) {
    showMessage("יש למלא את כל השדות", "error");
    return;
  }

  // ⏳ إعدادات زر الإرسال لإظهار حالة التحميل للمستخدم فوراً
  let submitBtn = null;
  let originalText = "קבע תור";
  
  if (e && e.target && e.target.tagName === 'BUTTON') {
    submitBtn = e.target;
  } else if (bookingForm) {
    submitBtn = bookingForm.querySelector("button");
  }

  if (submitBtn) {
    originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "שומר תור... ⏳";
  }

  try {
    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      const result = await res.json();
      const appointment = result.data;

      if (!appointment?._id) {
        throw new Error("Appointment ID is missing from the server response");
      }

      localStorage.setItem("pendingDepositAppointment", JSON.stringify({
        id: appointment._id,
        customerName: appointment.customerName,
        service: appointment.service,
        date: data.date,
        endTime: data.endTime,
        amount: appointment.depositAmount ?? 0
      }));
      
      if (bookingForm) bookingForm.reset();
      if (priceDisplay) priceDisplay.textContent = "";
      if (timeSelect) timeSelect.disabled = true;

      window.location.href = `./deposit.html?id=${encodeURIComponent(appointment._id)}`;
    } else {
      // إعادة الزر لوضعه الطبيعي في حال وجود خطأ في البيانات
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      const result = await res.json().catch(() => ({}));
      showMessage(result.error || "שגיאה בקביעת תור", "error");
    }

  } catch (error) {
    // إعادة الزر لوضعه الطبيعي في حال فشل الاتصال بالشبكة
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
    console.error("An error occurred during booking:", error);
    showMessage("שגיאת חיבור לשרת", "error");
  }
}

/* ===============================
   MESSAGE HELPER
=================================*/
function showMessage(text, type) {
  if (!messageBox) {
    alert(text);
    return;
  }
  messageBox.textContent = text;
  messageBox.className = type;
}
