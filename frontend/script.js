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
  loadHomeGalleryImages();
  initPhotoLine();
});

let HOME_GALLERY_IMAGES = [];
let photoLineIndex = 0;

async function loadHomeGalleryImages() {
  try {
    const res = await fetch(`${API_URL}/gallery`);
    if (!res.ok) throw new Error('Failed to load gallery');
    const images = await res.json();
    HOME_GALLERY_IMAGES = images.map(img => img.image);
    if (HOME_GALLERY_IMAGES.length) {
      movePhotoLine(0, 'auto');
    }
  } catch (error) {
    console.error('Error loading gallery:', error);
  }
}

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
    verifyPhoneTitle:'אימות מספר WhatsApp',sendVerificationCode:'שליחת קוד ב-WhatsApp',verificationCodePlaceholder:'קוד בן 6 ספרות',confirmVerificationCode:'אימות',invalidPhone:'מספר טלפון לא תקין',invalidCode:'קוד לא תקין',sendingCode:'שולח קוד...',codeSent:'קוד נשלח בהצלחה!',phoneVerified:'מספר מאומת',appointmentRequestSent:'בקשת התור נשלחה בהצלחה',verificationSendError:'שגיאה בשליחת קוד',navFeedback:'משוב',feedbackEyebrow:'החוויה שלך',feedbackTitle:'נשמח לשמוע ממך',feedbackText:'שתפי אותנו בחוויה שלך. המשוב יופיע אוטומטית בעמוד',feedbackError:'שגיאה בהעלאת משוב',feedbackSuccess:'תודה על המשוב!',reviewsEmpty:'אין משוב עדיין',navAbout:'אודות',navServices:'שירותים',navPortfolio:'גלריה',navReviews:'המלצות',navContact:'יצירת קשר',bookNow:'קבעי תור',heroEyebrow:'איפור כלות ואירוע',heroCopy:'יופי טבעי, רגעים בלתי נשכחים'
  },
  ar: {
    ownerLogin:'دخول صاحبة العمل',
    verifyPhoneTitle:'تأكيد رقم WhatsApp',sendVerificationCode:'إرسال رمز عبر WhatsApp',verificationCodePlaceholder:'رمز من 6 أرقام',confirmVerificationCode:'تأكيد',invalidPhone:'رقم هاتف غير صحيح',invalidCode:'رمز غير صحيح',sendingCode:'جاري الإرسال...',codeSent:'تم إرسال الرمز بنجاح!',phoneVerified:'تم التحقق من الرقم',appointmentRequestSent:'تم إرسال طلب الموعد بنجاح',verificationSendError:'خطأ في إرسال الرمز',navFeedback:'تقييم',feedbackEyebrow:'تجربتك',feedbackTitle:'يسعدنا سماع رأيك',feedbackText:'شاركي تجربتك معنا. سيظهر تقييمك تلقائياً في الصفحة',feedbackError:'خطأ في إرسال التقييم',feedbackSuccess:'شكراً على تقييمك!',reviewsEmpty:'لا توجد تقييمات حتى الآن',navAbout:'من أنا',navServices:'الخدمات',navPortfolio:'الأعمال',navReviews:'آراء العميلات',navContact:'تواصل',bookNow:'احجزي الآن',heroEyebrow:'مكياج عروس وحفلات',heroCopy:'جمال طبيعي، لحظات لا تنسى'
  },
  en: {
    ownerLogin:'Owner Login',
    verifyPhoneTitle:'Verify your WhatsApp number',sendVerificationCode:'Send WhatsApp Code',verificationCodePlaceholder:'6-digit code',confirmVerificationCode:'Verify Code',invalidPhone:'Invalid phone number',invalidCode:'Invalid code',sendingCode:'Sending code...',codeSent:'Code sent successfully!',phoneVerified:'Phone verified',appointmentRequestSent:'Appointment request sent successfully',verificationSendError:'Error sending code',depositFlowNote:'After approval, you\'ll receive a deposit payment link',navFeedback:'Feedback',feedbackEyebrow:'Your Experience',feedbackTitle:'We would love your feedback',feedbackText:'Share your experience with us. Your feedback will appear automatically on the page',feedbackError:'Error submitting feedback',feedbackSuccess:'Thank you for your feedback!',reviewsEmpty:'No reviews yet',navAbout:'About',navServices:'Services',navPortfolio:'Portfolio',navReviews:'Reviews',navContact:'Contact',bookNow:'Book Now',heroEyebrow:'Bridal & Event Makeup',heroCopy:'Natural beauty, unforgettable moments'
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
    message.textContent = `"${feedback.message}"`;
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
