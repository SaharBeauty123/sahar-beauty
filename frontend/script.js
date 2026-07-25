// ✅ تم التحديث ليرتبط بسيرفر Railway الجديد 24/7
const API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:5001/api'
  : '/api';

/* ===============================
   DOM ELEMENTS
=================================*/
const bookingForm = document.getElementById("bookingForm");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const serviceSelect = document.getElementById("service");
const messageBox = document.getElementById("messageBox");
const priceDisplay = document.getElementById("servicePriceDisplay");
const bookingVerification = document.getElementById('bookingVerification');
const bookingDetails = document.getElementById('bookingDetails');
let bookingVerificationToken = '';

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

  const sendCodeButton = document.getElementById('sendVerificationCode');
  const confirmCodeButton = document.getElementById('confirmVerificationCode');
  if (sendCodeButton) sendCodeButton.addEventListener('click', requestVerificationCode);
  if (confirmCodeButton) confirmCodeButton.addEventListener('click', confirmVerificationCode);
  initPhotoLine();
});

const HOME_GALLERY_IMAGES = [
  'images/sahar-hero.png',
  'images/ChatGPT-Image-Jun-22-2026-12_44_23-PM-600x600.png',
  'images/WhatsApp-Image-2024-05-16-at-18.44.15.webp',
  'images/images.jpg',
  'images/קסשצפךק.jpg'
];
let photoLineIndex = 0;

function normalizedPhotoIndex(index) {
  return (index + HOME_GALLERY_IMAGES.length) % HOME_GALLERY_IMAGES.length;
}

function updatePhotoLineState(index) {
  photoLineIndex = normalizedPhotoIndex(index);
  document.querySelectorAll('.photo-line-slide').forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === photoLineIndex));
  document.querySelectorAll('.photo-line-dot').forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === photoLineIndex));
}

function movePhotoLine(index, behavior = 'smooth') {
  const viewport = document.getElementById('photoLineViewport');
  const slides = document.querySelectorAll('.photo-line-slide');
  if (!viewport || !slides.length) return;
  const nextIndex = normalizedPhotoIndex(index);
  const slide = slides[nextIndex];
  viewport.scrollTo({ left: slide.offsetLeft - (viewport.clientWidth - slide.clientWidth) / 2, behavior });
  updatePhotoLineState(nextIndex);
}

function openPhotoLightbox(index) {
  const lightbox = document.getElementById('photoLightbox');
  const image = document.getElementById('photoLightboxImage');
  photoLineIndex = normalizedPhotoIndex(index);
  image.src = HOME_GALLERY_IMAGES[photoLineIndex];
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function movePhotoLightbox(direction) {
  photoLineIndex = normalizedPhotoIndex(photoLineIndex + direction);
  document.getElementById('photoLightboxImage').src = HOME_GALLERY_IMAGES[photoLineIndex];
  movePhotoLine(photoLineIndex);
}

function closePhotoLightbox() {
  document.getElementById('photoLightbox')?.classList.remove('open');
  document.body.style.overflow = '';
}

function initPhotoLine() {
  const track = document.getElementById('photoLineTrack');
  const viewport = document.getElementById('photoLineViewport');
  const dots = document.getElementById('photoLineDots');
  const lightbox = document.getElementById('photoLightbox');
  if (!track || !viewport || !dots || !lightbox) return;
  let suppressSlideClick = false;

  HOME_GALLERY_IMAGES.forEach((source, index) => {
    const slide = document.createElement('button');
    slide.type = 'button';
    slide.className = 'photo-line-slide';
    slide.setAttribute('aria-label', `Open portfolio photo ${index + 1}`);
    const image = document.createElement('img');
    image.src = source;
    image.alt = `Sahar Beauty portfolio ${index + 1}`;
    image.loading = index === 0 ? 'eager' : 'lazy';
    slide.appendChild(image);
    slide.addEventListener('click', () => { if (!suppressSlideClick) openPhotoLightbox(index); });
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'photo-line-dot';
    dot.addEventListener('click', () => movePhotoLine(index));
    dots.appendChild(dot);
  });

  document.getElementById('photoLinePrev').addEventListener('click', () => movePhotoLine(photoLineIndex - 1));
  document.getElementById('photoLineNext').addEventListener('click', () => movePhotoLine(photoLineIndex + 1));
  document.getElementById('photoLightboxPrev').addEventListener('click', () => movePhotoLightbox(-1));
  document.getElementById('photoLightboxNext').addEventListener('click', () => movePhotoLightbox(1));
  document.getElementById('photoLightboxClose').addEventListener('click', closePhotoLightbox);
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closePhotoLightbox(); });

  let pointerStartX = 0;
  let pointerStartScroll = 0;
  let pointerDragging = false;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    pointerStartX = event.clientX;
    pointerStartScroll = viewport.scrollLeft;
    pointerDragging = true;
    suppressSlideClick = false;
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!pointerDragging) return;
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) > 6) suppressSlideClick = true;
    viewport.scrollLeft = pointerStartScroll - distance;
  });
  viewport.addEventListener('pointerup', (event) => {
    if (!pointerDragging) return;
    pointerDragging = false;
    if (suppressSlideClick) setTimeout(() => { suppressSlideClick = false; }, 0);
  });

  let scrollFrame = null;
  viewport.addEventListener('scroll', () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const center = viewport.scrollLeft + viewport.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;
      document.querySelectorAll('.photo-line-slide').forEach((slide, index) => {
        const distance = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
        if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
      });
      updatePhotoLineState(closestIndex);
    });
  }, { passive: true });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 45) movePhotoLightbox(distance > 0 ? -1 : 1);
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') closePhotoLightbox();
    if (event.key === 'ArrowLeft') movePhotoLightbox(-1);
    if (event.key === 'ArrowRight') movePhotoLightbox(1);
  });

  requestAnimationFrame(() => movePhotoLine(0, 'auto'));
}

function getUiDictionary() {
  return translations[localStorage.getItem('saharLanguage') || 'he'] || translations.he;
}

function setVerificationMessage(text, type = '') {
  const element = document.getElementById('verificationMessage');
  if (!element) return;
  element.textContent = text;
  element.className = `feedback-status${type ? ` ${type}` : ''}`;
}

async function requestVerificationCode() {
  const phone = document.getElementById('verificationPhone').value.replace(/\D/g, '');
  const button = document.getElementById('sendVerificationCode');
  const dictionary = getUiDictionary();
  if (!/^05\d{8}$/.test(phone)) {
    setVerificationMessage(dictionary.invalidPhone, 'error');
    return;
  }
  button.disabled = true;
  setVerificationMessage(dictionary.sendingCode);
  try {
    const response = await fetch(`${API_URL}/verification/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || dictionary.verificationSendError);
    document.getElementById('verificationCodeRow').hidden = false;
    setVerificationMessage(dictionary.codeSent, 'success');
  } catch (error) {
    setVerificationMessage(error.message || dictionary.verificationSendError, 'error');
  } finally {
    button.disabled = false;
  }
}

async function confirmVerificationCode() {
  const phone = document.getElementById('verificationPhone').value.replace(/\D/g, '');
  const code = document.getElementById('verificationCode').value.trim();
  const button = document.getElementById('confirmVerificationCode');
  const dictionary = getUiDictionary();
  if (!/^\d{6}$/.test(code)) {
    setVerificationMessage(dictionary.invalidCode, 'error');
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`${API_URL}/verification/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    const result = await response.json();
    if (!response.ok || !result.token) throw new Error(result.error || dictionary.invalidCode);
    bookingVerificationToken = result.token;
    document.getElementById('phone').value = phone;
    document.getElementById('verifiedPhoneMessage').textContent = `${dictionary.phoneVerified}: ${phone}`;
    bookingVerification.hidden = true;
    bookingDetails.hidden = false;
  } catch (error) {
    setVerificationMessage(error.message || dictionary.invalidCode, 'error');
  } finally {
    button.disabled = false;
  }
}

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
    endTime: timeSelect.options[timeSelect.selectedIndex]?.dataset.endTime || "",
    verificationToken: bookingVerificationToken
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

      if (bookingForm) bookingForm.reset();
      if (priceDisplay) priceDisplay.textContent = "";
      if (timeSelect) timeSelect.disabled = true;
      bookingVerificationToken = '';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      bookingDetails.hidden = true;
      bookingVerification.hidden = false;
      document.getElementById('verificationCodeRow').hidden = true;
      setVerificationMessage(getUiDictionary().appointmentRequestSent, 'success');
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

/* ===============================
   MULTILINGUAL UI & INTERACTIONS
=================================*/
const translations = {
  he: {
    ownerLogin:'כניסת בעלת העסק',
    verifyPhoneTitle:'אימות מספר WhatsApp',sendVerificationCode:'שליחת קוד ב-WhatsApp',verificationCodePlaceholder:'קוד בן 6 ספרות',confirmVerificationCode:'אימות הקוד',depositFlowNote:'לאחר אישור Sahar Beauty תקבלי ב-WhatsApp קישור לתשלום הערבון.',submitAppointment:'שליחת בקשת התור',invalidPhone:'יש להזין מספר טלפון תקין',sendingCode:'שולחים קוד...',codeSent:'קוד האימות נשלח אלייך ב-WhatsApp.',verificationSendError:'לא הצלחנו לשלוח את הקוד',invalidCode:'קוד האימות אינו תקין',phoneVerified:'המספר אומת בהצלחה',appointmentRequestSent:'בקשת התור נשלחה. לאחר אישור Sahar Beauty תקבלי קישור לתשלום הערבון ב-WhatsApp.',
    navFeedback:'משוב',feedbackEyebrow:'החוויה שלך',feedbackTitle:'נשמח לשמוע ממך',feedbackText:'שתפי אותנו בחוויה שלך. המשוב יופיע אוטומטית באזור המלצות הלקוחות.',feedbackRating:'דירוג',feedbackPlaceholder:'כתבי לנו על החוויה שלך',sendFeedback:'פרסום משוב',feedbackSuccess:'תודה! המשוב שלך פורסם בהצלחה.',feedbackError:'לא הצלחנו לשמור את המשוב. נסי שוב.',reviewsEmpty:'עדיין אין משובים. שלך יכול להיות הראשון.',
    navAbout:'אודות',navServices:'שירותים',navPortfolio:'גלריה',navReviews:'המלצות',navContact:'יצירת קשר',bookNow:'קבעי תור',heroEyebrow:'איפור כלות ואירועים',heroCopy:'יופי טבעי, נוכחות שקטה וחוויה אישית שמרגישה יוקרתית מהרגע הראשון.',aboutEyebrow:'הסיפור של Sahar Beauty',aboutTitle:'יופי שמרגיש בדיוק כמוך.',aboutP1:'Sahar היא מאפרת המתמחה בכלות ובאיפור ערב, עם ניסיון מקצועי וגישה מדויקת שמדגישה את היופי הטבעי במקום להסתיר אותו.',aboutP2:'כל מפגש בנוי כחוויה רגועה, אישית ומוקפדת — משיחת ההיכרות וההזמנה ועד הרגע האחרון של האירוע.',servicesEyebrow:'השירותים שלנו',servicesTitle:'נוצר במיוחד לרגע שלך',serviceBridal:'איפור כלות',serviceBridalText:'מראה עמיד, מצולם ומדויק שמלווה אותך ברכות לאורך היום.',serviceEngagement:'איפור אירוסין',serviceEngagementText:'זוהר אלגנטי ומאוזן לערב חד־פעמי ובלתי נשכח.',serviceEvent:'איפור אירועים',serviceEventText:'מראה מחמיא ומוקפד שמותאם לסגנון, לבגד ולתאורה.',servicePhoto:'איפור לצילומים',servicePhotoText:'איפור מקצועי שמעניק עומק, אחידות ונוכחות מול המצלמה.',comingSoon:'בקרוב',masterclasses:'כיתות אמן וקורסי איפור',training:'הכשרה מקצועית',privateLessons:'שיעורים פרטיים 1:1',portfolioEyebrow:'עבודות נבחרות',portfolioTitle:'רגעים של יופי שקט',portfolioText:'גלריית כלות ואירועים, לצד אפשרות לשילוב סרטוני Instagram Reels ועבודות וידאו.',viewGallery:'לגלריה המלאה ←',brides:'כלות',events:'אירועים',reviewsEyebrow:'מילים מהלב',reviewsTitle:'מה הלקוחות מספרות',review1:'“הרגשתי הכי אני, רק זוהרת ומדויקת יותר. האיפור נשאר מושלם עד סוף הערב.”',review2:'“Sahar הייתה רגועה, קשובה ומקצועית. כל התהליך הרגיש נעים ויוקרתי.”',review3:'“התוצאה הצטלמה מדהים והחזיקה כל היום. קיבלתי אינסוף מחמאות.”',bride:'כלה',eventClient:'אירוע',bookingEyebrow:'הזמנת תור',bookingTitle:'בואי ניצור יחד את המראה שלך',bookingText:'בחרי שירות, תאריך ושעת סיום רצויה. שעת ההגעה תחושב עבורך באופן אוטומטי.',depositNote:'לאחר שליחת הבקשה תועברי לבחירת אמצעי תשלום לערבון.',stepLabel:'הפרטים שלך',fullName:'שם מלא',namePlaceholder:'השם שלך',phone:'טלפון',chooseService:'בחירת שירות',date:'תאריך',endTime:'שעת סיום התור',chooseFirst:'בחרי תאריך ושירות',continueBooking:'המשך להזמנה',contactEyebrow:'נשארות בקשר',contactTitle:'יש לך שאלה לפני שמזמינים?',contactText:'כתבי לנו ונחזור אלייך עם כל הפרטים כדי שתגיעי לרגע שלך רגועה ובטוחה.',messagePlaceholder:'איך נוכל לעזור?',sendMessage:'שליחת הודעה'
  },
  ar: {
    ownerLogin:'دخول صاحبة العمل',
    verifyPhoneTitle:'تأكيد رقم WhatsApp',sendVerificationCode:'إرسال رمز عبر WhatsApp',verificationCodePlaceholder:'رمز من 6 أرقام',confirmVerificationCode:'تأكيد الرمز',depositFlowNote:'بعد موافقة Sahar Beauty سيصلك رابط دفع العربون عبر WhatsApp.',submitAppointment:'إرسال طلب الموعد',invalidPhone:'أدخلي رقم هاتف صحيحاً',sendingCode:'جارٍ إرسال الرمز...',codeSent:'تم إرسال رمز التأكيد عبر WhatsApp.',verificationSendError:'تعذر إرسال الرمز',invalidCode:'رمز التأكيد غير صحيح',phoneVerified:'تم تأكيد الرقم',appointmentRequestSent:'تم إرسال طلب الموعد. بعد موافقة Sahar Beauty سيصلك رابط دفع العربون عبر WhatsApp.',
    navFeedback:'تقييم',feedbackEyebrow:'تجربتك',feedbackTitle:'يسعدنا سماع رأيك',feedbackText:'شاركي تجربتك معنا. سيظهر تقييمك تلقائياً في قسم آراء العميلات.',feedbackRating:'التقييم',feedbackPlaceholder:'اكتبي لنا عن تجربتك',sendFeedback:'نشر التقييم',feedbackSuccess:'شكراً! تم نشر تقييمك بنجاح.',feedbackError:'تعذر حفظ التقييم. حاولي مرة أخرى.',reviewsEmpty:'لا توجد تقييمات بعد. يمكنك أن تكوني الأولى.',
    navAbout:'من أنا',navServices:'الخدمات',navPortfolio:'الأعمال',navReviews:'آراء العميلات',navContact:'تواصل',bookNow:'احجزي الآن',heroEyebrow:'مكياج عرائس ومناسبات',heroCopy:'جمال طبيعي، حضور هادئ وتجربة شخصية فاخرة منذ اللحظة الأولى.',aboutEyebrow:'قصة Sahar Beauty',aboutTitle:'جمال يشبهك تماماً.',aboutP1:'سحر خبيرة مكياج متخصصة بالعرائس والمناسبات، بخبرة مهنية ورؤية دقيقة تبرز الجمال الطبيعي ولا تخفيه.',aboutP2:'كل لقاء هو تجربة هادئة، شخصية ومدروسة — من التعارف والحجز وحتى اللحظة الأخيرة من المناسبة.',servicesEyebrow:'خدماتنا',servicesTitle:'صُمم خصيصاً للحظتك',serviceBridal:'مكياج عرائس',serviceBridalText:'إطلالة ثابتة، متقنة وجميلة أمام الكاميرا ترافقك طوال اليوم.',serviceEngagement:'مكياج خطوبة',serviceEngagementText:'إشراقة أنيقة ومتوازنة لأمسية مميزة لا تُنسى.',serviceEvent:'مكياج مناسبات',serviceEventText:'إطلالة مدروسة تناسب أسلوبك، ملابسك وإضاءة المناسبة.',servicePhoto:'مكياج جلسات تصوير',servicePhotoText:'مكياج احترافي يمنح عمقاً وتناسقاً وحضوراً أمام الكاميرا.',comingSoon:'قريباً',masterclasses:'كورسات وماستر كلاس مكياج',training:'دورات احترافية',privateLessons:'دروس خاصة 1:1',portfolioEyebrow:'أعمال مختارة',portfolioTitle:'لحظات من الجمال الهادئ',portfolioText:'معرض للعرائس والمناسبات مع إمكانية دمج Instagram Reels وأعمال الفيديو.',viewGallery:'شاهدي المعرض الكامل ←',brides:'عرائس',events:'مناسبات',reviewsEyebrow:'كلمات من القلب',reviewsTitle:'ماذا تقول عميلاتنا',review1:'“شعرت أنني أنا، لكن بإشراقة ودقة أكبر. بقي المكياج مثالياً حتى نهاية السهرة.”',review2:'“كانت سحر هادئة، متفهمة ومحترفة. التجربة كلها كانت مريحة وفاخرة.”',review3:'“النتيجة بدت رائعة في الصور وثبتت طوال اليوم. تلقيت الكثير من الإطراءات.”',bride:'عروس',eventClient:'مناسبة',bookingEyebrow:'حجز موعد',bookingTitle:'لنصنع إطلالتك معاً',bookingText:'اختاري الخدمة، التاريخ ووقت الانتهاء المطلوب. سيُحسب وقت الوصول تلقائياً.',depositNote:'بعد إرسال الطلب ستنتقلين لاختيار طريقة دفع العربون.',stepLabel:'بياناتك',fullName:'الاسم الكامل',namePlaceholder:'اسمك',phone:'الهاتف',chooseService:'اختيار الخدمة',date:'التاريخ',endTime:'وقت انتهاء الموعد',chooseFirst:'اختاري التاريخ والخدمة',continueBooking:'متابعة الحجز',contactEyebrow:'لنبقى على تواصل',contactTitle:'لديك سؤال قبل الحجز؟',contactText:'اكتبي لنا وسنعود إليك بكل التفاصيل لتصلي إلى مناسبتك بهدوء وثقة.',messagePlaceholder:'كيف يمكننا مساعدتك؟',sendMessage:'إرسال الرسالة'
  },
  en: {
    ownerLogin:'Owner Login',
    verifyPhoneTitle:'Verify your WhatsApp number',sendVerificationCode:'Send WhatsApp Code',verificationCodePlaceholder:'6-digit code',confirmVerificationCode:'Verify Code',depositFlowNote:'After Sahar Beauty approves your request, you will receive a WhatsApp deposit payment link.',submitAppointment:'Send Appointment Request',invalidPhone:'Enter a valid phone number',sendingCode:'Sending code...',codeSent:'The verification code was sent via WhatsApp.',verificationSendError:'We could not send the code',invalidCode:'The verification code is invalid',phoneVerified:'Phone verified',appointmentRequestSent:'Your appointment request was sent. After Sahar Beauty approves it, you will receive a WhatsApp deposit payment link.',
    navFeedback:'Feedback',feedbackEyebrow:'Your Experience',feedbackTitle:'We would love your feedback',feedbackText:'Share your experience with us. Your feedback will appear automatically in the client reviews section.',feedbackRating:'Rating',feedbackPlaceholder:'Tell us about your experience',sendFeedback:'Publish Feedback',feedbackSuccess:'Thank you! Your feedback was published.',feedbackError:'We could not save your feedback. Please try again.',reviewsEmpty:'No feedback yet. Yours could be the first.',
    navAbout:'About',navServices:'Services',navPortfolio:'Portfolio',navReviews:'Reviews',navContact:'Contact',bookNow:'Book Now',heroEyebrow:'Bridal & Event Makeup',heroCopy:'Natural beauty, quiet confidence, and a personal luxury experience from the very first moment.',aboutEyebrow:'The Sahar Beauty Story',aboutTitle:'Beauty that feels like you.',aboutP1:'Sahar is a bridal and evening makeup specialist with professional experience and a precise approach that enhances natural beauty rather than masking it.',aboutP2:'Every appointment is designed as a calm, personal and polished experience — from the first conversation and booking until the event comes to an end.',servicesEyebrow:'Our Services',servicesTitle:'Created for your moment',serviceBridal:'Bridal Makeup',serviceBridalText:'A lasting, camera-ready look that stays refined throughout your day.',serviceEngagement:'Engagement Makeup',serviceEngagementText:'Elegant, balanced radiance for a singular and unforgettable evening.',serviceEvent:'Event Makeup',serviceEventText:'A polished look tailored to your style, outfit and event lighting.',servicePhoto:'Photoshoot Makeup',servicePhotoText:'Professional makeup that creates depth, balance and presence on camera.',comingSoon:'Coming Soon',masterclasses:'Makeup Masterclasses & Courses',training:'Professional Training',privateLessons:'Private 1-on-1 Lessons',portfolioEyebrow:'Selected Work',portfolioTitle:'Moments of quiet beauty',portfolioText:'A curated bridal and event gallery, ready for Instagram Reels and video integration.',viewGallery:'View Full Gallery →',brides:'Brides',events:'Events',reviewsEyebrow:'Kind Words',reviewsTitle:'What clients say',review1:'“I felt completely myself, only more radiant and refined. The makeup stayed perfect all evening.”',review2:'“Sahar was calm, attentive and professional. The entire experience felt comfortable and luxurious.”',review3:'“The result photographed beautifully and lasted all day. I received endless compliments.”',bride:'Bride',eventClient:'Event',bookingEyebrow:'Appointment',bookingTitle:'Let’s create your look together',bookingText:'Choose a service, date and preferred end time. Your arrival time will be calculated automatically.',depositNote:'After submitting, you will choose your preferred deposit payment method.',stepLabel:'Your Details',fullName:'Full Name',namePlaceholder:'Your name',phone:'Phone',chooseService:'Choose a Service',date:'Date',endTime:'Appointment End Time',chooseFirst:'Choose a date and service',continueBooking:'Continue Booking',contactEyebrow:'Stay in Touch',contactTitle:'A question before you book?',contactText:'Write to us and we’ll return with everything you need to arrive feeling calm and confident.',messagePlaceholder:'How can we help?',sendMessage:'Send Message'
  }
};

function setLanguage(language) {
  const lang = translations[language] ? language : 'he';
  const dictionary = translations[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  localStorage.setItem('saharLanguage', lang);
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    if (dictionary[element.dataset.i18n]) element.textContent = dictionary[element.dataset.i18n];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    if (dictionary[element.dataset.i18nPlaceholder]) element.placeholder = dictionary[element.dataset.i18nPlaceholder];
  });
  document.querySelectorAll('[data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === lang));
  renderFeedback(feedbackItems);
}

let feedbackItems = [];

function renderFeedback(items) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  grid.replaceChildren();
  const lang = localStorage.getItem('saharLanguage') || 'he';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = (translations[lang] || translations.he).reviewsEmpty;
    grid.appendChild(empty);
    return;
  }

  items.forEach((feedback) => {
    const card = document.createElement('blockquote');
    card.className = 'review-card reveal visible';
    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.textContent = `${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}`;
    const message = document.createElement('p');
    message.textContent = `“${feedback.message}”`;
    const footer = document.createElement('footer');
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = Array.from(feedback.name)[0]?.toUpperCase() || 'S';
    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = feedback.name;
    const date = document.createElement('small');
    date.textContent = new Date(feedback.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'he-IL');
    details.append(name, date);
    footer.append(avatar, details);
    card.append(stars, message, footer);
    grid.appendChild(card);
  });
}

async function loadFeedback() {
  try {
    const response = await fetch(`${API_URL}/feedback`);
    if (!response.ok) throw new Error('Unable to load feedback');
    feedbackItems = await response.json();
  } catch (error) {
    console.error('Feedback load failed:', error);
    feedbackItems = [];
  }
  renderFeedback(feedbackItems);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
  setLanguage(localStorage.getItem('saharLanguage') || 'he');

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.main-nav');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const isOpen = navigation.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => navigation.classList.remove('open')));
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible'));
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

  loadFeedback();

  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('feedbackStatus');
    const submitButton = feedbackForm.querySelector('button[type="submit"]');
    const lang = localStorage.getItem('saharLanguage') || 'he';
    const dictionary = translations[lang] || translations.he;
    submitButton.disabled = true;
    status.textContent = '';
    status.className = 'feedback-status';
    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('feedbackName').value,
          rating: Number(document.getElementById('feedbackRating').value),
          message: document.getElementById('feedbackMessage').value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || dictionary.feedbackError);
      feedbackItems = [result, ...feedbackItems].slice(0, 12);
      renderFeedback(feedbackItems);
      feedbackForm.reset();
      status.textContent = dictionary.feedbackSuccess;
      status.className = 'feedback-status success';
    } catch (error) {
      console.error('Feedback submit failed:', error);
      status.textContent = dictionary.feedbackError;
      status.className = 'feedback-status error';
    } finally {
      submitButton.disabled = false;
    }
  });
});
