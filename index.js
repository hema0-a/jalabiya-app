/* ============================================================
   Cloud Function: نشرة يومية للورشة (تسليم قريب + متأخر + طاقة)
   ============================================================
   بتشتغل مرة كل يوم (الميعاد قابل للتعديل تحت). بتراجع كل ورشة
   مخزّنة في Firestore (collection: workshops)، وبتبني كل الحاجات
   اللي تستاهل تنبيه، وتبعتها **في إشعار واحد بس** (مش أكتر) لأي
   جهاز مسجّل عند الورشة:
     1) طلبات هيتسلموا خلال "عدد الأيام" اللي الورشة حددتها
     2) طلبات متأخرة فعلاً (عدّى ميعاد تسليمها ولسه ما اتسلمتش)
     3) تحذير لو حجم شغل بكرة فوق الطاقة اليومية

   النشر (مرة واحدة فقط):
     1) firebase login
     2) داخل مجلد المشروع: firebase deploy --only functions
   (لازم مشروع Firebase يكون على خطة Blaze - "ادفع حسب الاستخدام"،
   وهي مجانية عمليًا للاستخدام الصغير زي ده، بس لازم تفعيلها من
   إعدادات الفوترة في Firebase Console الأول)
   ============================================================ */

const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// غيّر التوقيت هنا لو حابب الإشعار يوصل في وقت تاني (فورمات cron قياسي)
// المثال ده بيشتغل الساعة 8 الصبح بتوقيت القاهرة كل يوم
exports.dailyDeliveryReminders = onSchedule(
  {schedule: '0 8 * * *', timeZone: 'Africa/Cairo'},
  async () => {
    const snap = await db.collection('workshops').get();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const jobs = [];
    snap.forEach((doc) => {
      jobs.push(processWorkshop(doc, todayStr));
    });
    await Promise.all(jobs);
    return null;
  }
);

// نفس صيغة orderTotal(o) الموجودة في core.js بالظبط (subtotal - discount + tax)
function orderTotalServer(o) {
  let subtotal;
  if (Array.isArray(o.items) && o.items.length) {
    const itemsSum = o.items.reduce(
      (s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0
    );
    subtotal = itemsSum + (Number(o.extra) || 0);
  } else {
    subtotal = (Number(o.fee) || 0) + (Number(o.extra) || 0);
  }
  let discount = 0;
  if (o.discountType === 'percent') {
    discount = Math.min(subtotal, subtotal * (Number(o.discountValue) || 0) / 100);
  } else if (o.discountType === 'amount') {
    discount = Math.min(subtotal, Math.max(0, Number(o.discountValue) || 0));
  }
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (Number(o.taxPercent) || 0) / 100;
  return Math.max(0, afterDiscount + tax);
}

async function processWorkshop(doc, todayStr) {
  const data = doc.data();
  const pushNotify = data.pushNotify || {};
  const tokens = Array.isArray(pushNotify.deviceTokens) ? pushNotify.deviceTokens : [];
  if (!tokens.length) return;

  const orders = Array.isArray(data.orders) ? data.orders : [];
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const lines = [];

  /* ---------- ١) طلبات هيتسلموا قريب (تتبع بالـ id، مرة لكل طلب) ---------- */
  const daysBefore = Number(pushNotify.daysBefore) || 1;
  const targetDate = new Date(todayStr);
  targetDate.setDate(targetDate.getDate() + daysBefore);
  const targetStr = targetDate.toISOString().slice(0, 10);

  const alreadyNotified = new Set(pushNotify.notifiedOrderIds || []);
  const dueOrders = orders.filter((o) =>
    o.dateDelivery === targetStr &&
    o.status !== 'تم التسليم' &&
    !alreadyNotified.has(o.id)
  );

  if (dueOrders.length === 1) {
    const o = dueOrders[0];
    const c = customers.find((x) => x.id === o.customerId);
    lines.push('🔔 ' + (c ? c.name : 'عميل') + ' — طلبه مستحق تسليمه بعد ' + daysBefore + ' يوم');
  } else if (dueOrders.length > 1) {
    lines.push('🔔 ' + dueOrders.length + ' طلبات قريب موعد تسليمها (بعد ' + daysBefore + ' يوم)');
  }

  /* ---------- ٢) طلبات متأخرة فعلاً (تتبع بتاريخ اليوم، مرة واحدة يوميًا) ---------- */
  // ملحوظة: بيتكرر كل يوم لحد ما الطلب يتسلم أو الطاقة تتغيّر — عكس
  // تنبيه "قريب" اللي بيتبعت مرة واحدة بس لكل طلب
  const alreadySentToday = pushNotify.lastCapacityLateAlertDate === todayStr;
  let willMarkCapacityLateToday = false;

  if (!alreadySentToday) {
    const lateOrders = orders.filter(
      (o) => o.dateDelivery && o.dateDelivery < todayStr && o.status !== 'تم التسليم'
    );
    if (lateOrders.length) {
      lines.push('⏰ عندك ' + lateOrders.length + ' طلب متأخر بالفعل ولسه ما اتسلّمش');
      willMarkCapacityLateToday = true;
    }

    const capacity = Number(data.dailyCapacity) || 500;
    const tomorrow = new Date(todayStr);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const tomorrowValue = orders
      .filter((o) => o.dateDelivery === tomorrowStr && o.status !== 'تم التسليم')
      .reduce((s, o) => s + orderTotalServer(o), 0);
    if (tomorrowValue > capacity) {
      lines.push('⚠️ حجم شغل بكرة (' + Math.round(tomorrowValue).toLocaleString('ar-EG') + ' ج.م) فوق طاقتك اليومية');
      willMarkCapacityLateToday = true;
    }
  }

  /* ---------- مفيش حاجة تستاهل إشعار النهاردة ---------- */
  if (!lines.length) return;

  /* ---------- إشعار واحد بس يجمع كل حاجة تستاهل ---------- */
  const title = lines.length === 1 ? '🧵 نشرة اليوم' : '🧵 نشرة اليوم (' + lines.length + ')';
  const body = lines.join(' — ');

  // توكنز أجهزة اتمسحت/اتفصلت (تطبيق اتحذف، بيانات المتصفح اتمسحت...) بترجع
  // من FCM بكود خطأ واضح. لو سبناها من غير تنظيف، هتفضل تتراكم في deviceTokens
  // للأبد وكل يوم هنحاول نبعت لتوكنز ميتة بلا فايدة (وممكن كمان تعدي حد الـ 500
  // توكن لكل استدعاء لو الورشة قديمة وعندها كذا جهاز اتغيّر بمرور الوقت).
  let liveTokens = tokens;
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {title, body},
      webpush: {
        fcmOptions: {link: '/'}
      }
    });
    const deadCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument'
    ]);
    const deadTokens = new Set();
    res.responses.forEach((r, i) => {
      if (!r.success && r.error && deadCodes.has(r.error.code)) deadTokens.add(tokens[i]);
    });
    if (deadTokens.size) liveTokens = tokens.filter((t) => !deadTokens.has(t));
  } catch (e) {
    console.warn('فشل إرسال الإشعار لورشة', doc.id, e);
    return;
  }

  // بنحدّث الحقول مع بعض في نفس الاستدعاء (مفيش تعارض، كل حقل بمساره
  // بتاعه)، من غير ما نلمس updatedAt عشان منعملش تعارض مع منطق
  // "آخر تعديل بيكسب" المستخدم في مزامنة التطبيق بين الأجهزة
  const updates = {};
  if (dueOrders.length) {
    // بنشيل أي id بقى مش موجود أصلاً في الطلبات الحالية (اتسلّم من زمان، اتمسح،
    // إلخ) عشان القايمة متكبرش للأبد على مدار عمر الورشة كله
    const currentOrderIds = new Set(orders.map((o) => o.id));
    const merged = Array.from(alreadyNotified).concat(dueOrders.map((o) => o.id));
    updates['pushNotify.notifiedOrderIds'] = merged.filter((id) => currentOrderIds.has(id));
  }
  if (willMarkCapacityLateToday) {
    updates['pushNotify.lastCapacityLateAlertDate'] = todayStr;
  }
  if (liveTokens.length !== tokens.length) {
    updates['pushNotify.deviceTokens'] = liveTokens;
  }
  if (Object.keys(updates).length) {
    await doc.ref.update(updates);
  }
}
