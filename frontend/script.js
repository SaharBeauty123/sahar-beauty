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

/* ===============================
   MULTILINGUAL UI & INTERACTIONS
=================================*/
const translations = {
  he: {
    navAbout:'אודות',navServices:'שירותים',navPortfolio:'גלריה',navReviews:'המלצות',navContact:'יצירת קשר',bookNow:'קבעי תור',heroEyebrow:'איפור כלות ואירועים',heroCopy:'יופי טבעי, נוכחות שקטה וחוויה אישית שמרגישה יוקרתית מהרגע הראשון.',aboutEyebrow:'הסיפור של Sahar Beauty',aboutTitle:'יופי שמרגיש בדיוק כמוך.',aboutP1:'Sahar היא מאפרת המתמחה בכלות ובאיפור ערב, עם ניסיון מקצועי וגישה מדויקת שמדגישה את היופי הטבעי במקום להסתיר אותו.',aboutP2:'כל מפגש בנוי כחוויה רגועה, אישית ומוקפדת — משיחת ההיכרות וההזמנה ועד הרגע האחרון של האירוע.',servicesEyebrow:'השירותים שלנו',servicesTitle:'נוצר במיוחד לרגע שלך',serviceBridal:'איפור כלות',serviceBridalText:'מראה עמיד, מצולם ומדויק שמלווה אותך ברכות לאורך היום.',serviceEngagement:'איפור אירוסין',serviceEngagementText:'זוהר אלגנטי ומאוזן לערב חד־פעמי ובלתי נשכח.',serviceEvent:'איפור אירועים',serviceEventText:'מראה מחמיא ומוקפד שמותאם לסגנון, לבגד ולתאורה.',servicePhoto:'איפור לצילומים',servicePhotoText:'איפור מקצועי שמעניק עומק, אחידות ונוכחות מול המצלמה.',comingSoon:'בקרוב',masterclasses:'כיתות אמן וקורסי איפור',training:'הכשרה מקצועית',privateLessons:'שיעורים פרטיים 1:1',portfolioEyebrow:'עבודות נבחרות',portfolioTitle:'רגעים של יופי שקט',portfolioText:'גלריית כלות ואירועים, לצד אפשרות לשילוב סרטוני Instagram Reels ועבודות וידאו.',viewGallery:'לגלריה המלאה ←',brides:'כלות',events:'אירועים',reviewsEyebrow:'מילים מהלב',reviewsTitle:'מה הלקוחות מספרות',review1:'“הרגשתי הכי אני, רק זוהרת ומדויקת יותר. האיפור נשאר מושלם עד סוף הערב.”',review2:'“Sahar הייתה רגועה, קשובה ומקצועית. כל התהליך הרגיש נעים ויוקרתי.”',review3:'“התוצאה הצטלמה מדהים והחזיקה כל היום. קיבלתי אינסוף מחמאות.”',bride:'כלה',eventClient:'אירוע',bookingEyebrow:'הזמנת תור',bookingTitle:'בואי ניצור יחד את המראה שלך',bookingText:'בחרי שירות, תאריך ושעת סיום רצויה. שעת ההגעה תחושב עבורך באופן אוטומטי.',depositNote:'לאחר שליחת הבקשה תועברי לבחירת אמצעי תשלום לערבון.',stepLabel:'הפרטים שלך',fullName:'שם מלא',namePlaceholder:'השם שלך',phone:'טלפון',chooseService:'בחירת שירות',date:'תאריך',endTime:'שעת סיום התור',chooseFirst:'בחרי תאריך ושירות',continueBooking:'המשך להזמנה',contactEyebrow:'נשארות בקשר',contactTitle:'יש לך שאלה לפני שמזמינים?',contactText:'כתבי לנו ונחזור אלייך עם כל הפרטים כדי שתגיעי לרגע שלך רגועה ובטוחה.',messagePlaceholder:'איך נוכל לעזור?',sendMessage:'שליחת הודעה'
  },
  ar: {
    navAbout:'من أنا',navServices:'الخدمات',navPortfolio:'الأعمال',navReviews:'آراء العميلات',navContact:'تواصل',bookNow:'احجزي الآن',heroEyebrow:'مكياج عرائس ومناسبات',heroCopy:'جمال طبيعي، حضور هادئ وتجربة شخصية فاخرة منذ اللحظة الأولى.',aboutEyebrow:'قصة Sahar Beauty',aboutTitle:'جمال يشبهك تماماً.',aboutP1:'سحر خبيرة مكياج متخصصة بالعرائس والمناسبات، بخبرة مهنية ورؤية دقيقة تبرز الجمال الطبيعي ولا تخفيه.',aboutP2:'كل لقاء هو تجربة هادئة، شخصية ومدروسة — من التعارف والحجز وحتى اللحظة الأخيرة من المناسبة.',servicesEyebrow:'خدماتنا',servicesTitle:'صُمم خصيصاً للحظتك',serviceBridal:'مكياج عرائس',serviceBridalText:'إطلالة ثابتة، متقنة وجميلة أمام الكاميرا ترافقك طوال اليوم.',serviceEngagement:'مكياج خطوبة',serviceEngagementText:'إشراقة أنيقة ومتوازنة لأمسية مميزة لا تُنسى.',serviceEvent:'مكياج مناسبات',serviceEventText:'إطلالة مدروسة تناسب أسلوبك، ملابسك وإضاءة المناسبة.',servicePhoto:'مكياج جلسات تصوير',servicePhotoText:'مكياج احترافي يمنح عمقاً وتناسقاً وحضوراً أمام الكاميرا.',comingSoon:'قريباً',masterclasses:'كورسات وماستر كلاس مكياج',training:'دورات احترافية',privateLessons:'دروس خاصة 1:1',portfolioEyebrow:'أعمال مختارة',portfolioTitle:'لحظات من الجمال الهادئ',portfolioText:'معرض للعرائس والمناسبات مع إمكانية دمج Instagram Reels وأعمال الفيديو.',viewGallery:'شاهدي المعرض الكامل ←',brides:'عرائس',events:'مناسبات',reviewsEyebrow:'كلمات من القلب',reviewsTitle:'ماذا تقول عميلاتنا',review1:'“شعرت أنني أنا، لكن بإشراقة ودقة أكبر. بقي المكياج مثالياً حتى نهاية السهرة.”',review2:'“كانت سحر هادئة، متفهمة ومحترفة. التجربة كلها كانت مريحة وفاخرة.”',review3:'“النتيجة بدت رائعة في الصور وثبتت طوال اليوم. تلقيت الكثير من الإطراءات.”',bride:'عروس',eventClient:'مناسبة',bookingEyebrow:'حجز موعد',bookingTitle:'لنصنع إطلالتك معاً',bookingText:'اختاري الخدمة، التاريخ ووقت الانتهاء المطلوب. سيُحسب وقت الوصول تلقائياً.',depositNote:'بعد إرسال الطلب ستنتقلين لاختيار طريقة دفع العربون.',stepLabel:'بياناتك',fullName:'الاسم الكامل',namePlaceholder:'اسمك',phone:'الهاتف',chooseService:'اختيار الخدمة',date:'التاريخ',endTime:'وقت انتهاء الموعد',chooseFirst:'اختاري التاريخ والخدمة',continueBooking:'متابعة الحجز',contactEyebrow:'لنبقى على تواصل',contactTitle:'لديك سؤال قبل الحجز؟',contactText:'اكتبي لنا وسنعود إليك بكل التفاصيل لتصلي إلى مناسبتك بهدوء وثقة.',messagePlaceholder:'كيف يمكننا مساعدتك؟',sendMessage:'إرسال الرسالة'
  },
  en: {
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

  const contactForm = document.getElementById('contactForm');
  if (contactForm) contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = `${document.getElementById('contactName').value}\n${document.getElementById('contactPhone').value}\n${document.getElementById('contactMessage').value}`;
    window.open(`https://wa.me/972503172506?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  });
});
