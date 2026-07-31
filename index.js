/* ============================================================
   Cloud Function: تذكير يومي بمواعيد التسليم القريبة
   ============================================================
   بتشتغل مرة كل يوم (الميعاد قابل للتعديل تحت). بتراجع كل ورشة
   مخزّنة في Firestore (collection: workshops)، وبتبعت إشعار حقيقي
   (Push) لأي جهاز مسجّل عندها لو فيه طلب هيتسلم خلال "عدد الأيام"
   اللي الورشة حددتها في الإعدادات (افتراضي: يوم واحد قبل الميعاد).

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

async function processWorkshop(doc, todayStr) {
  const data = doc.data();
  const pushNotify = data.pushNotify || {};
  const tokens = Array.isArray(pushNotify.deviceTokens) ? pushNotify.deviceTokens : [];
  if (!tokens.length) return;

  const daysBefore = Number(pushNotify.daysBefore) || 1;
  const targetDate = new Date(todayStr);
  targetDate.setDate(targetDate.getDate() + daysBefore);
  const targetStr = targetDate.toISOString().slice(0, 10);

  const orders = Array.isArray(data.orders) ? data.orders : [];
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const alreadyNotified = new Set(pushNotify.notifiedOrderIds || []);

  // الطلبات اللي ميعاد تسليمها = تاريخ الهدف (يوم/أيام قبل التسليم حسب إعداد الورشة)
  // ومتسلمتش لسه، ولسه ما اتبعتش عنها إشعار قبل كده
  const dueOrders = orders.filter((o) =>
    o.dateDelivery === targetStr &&
    o.status !== 'تم التسليم' &&
    !alreadyNotified.has(o.id)
  );

  if (!dueOrders.length) return;

  let title;
  let body;
  if (dueOrders.length === 1) {
    const o = dueOrders[0];
    const c = customers.find((x) => x.id === o.customerId);
    title = '🔔 موعد تسليم قريب';
    body = (c ? c.name : 'عميل') + ' — الطلب مستحق تسليمه بعد ' + daysBefore + ' يوم';
  } else {
    title = '🔔 ' + dueOrders.length + ' طلبات قريب موعد تسليمها';
    body = 'راجع لستة الطلبات في التطبيق — بعد ' + daysBefore + ' يوم من دلوقتي';
  }

  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {title, body},
      webpush: {
        fcmOptions: {link: '/'}
      }
    });
  } catch (e) {
    console.warn('فشل إرسال الإشعار لورشة', doc.id, e);
    return;
  }

  // نسجّل إن الطلبات دي اتبعت عنها إشعار فعلاً عشان منكررش الإشعار تاني كل يوم
  const updatedNotified = Array.from(alreadyNotified).concat(dueOrders.map((o) => o.id));
  // بنحدّث الحقل ده لوحده من غير ما نلمس updatedAt، عشان منعملش تعارض
  // مع منطق "آخر تعديل بيكسب" المستخدم في مزامنة التطبيق بين الأجهزة
  await doc.ref.update({'pushNotify.notifiedOrderIds': updatedNotified});
}
