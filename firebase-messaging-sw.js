/* ============================================================
   firebase-messaging-sw.js
   ============================================================
   هذا الملف مسؤول عن استقبال الإشعارات الحقيقية (Push) وإظهارها
   على الموبايل حتى لو التطبيق مقفول تمامًا. لازم يكون في نفس
   مجلد index.html (بجانبه على السيرفر) بنفس الاسم ده بالظبط.

   إعدادات مشروع Firebase بتتبعت له عن طريق الـ query string وقت
   التسجيل (navigator.serviceWorker.register('firebase-messaging-sw.js?...'))
   عشان نفس الملف يشتغل مع أي ورشة عندها مشروع Firebase مختلف،
   من غير ما نحتاج نعدّل الملف يدويًا لكل عميل.
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || '',
  authDomain: urlParams.get('authDomain') || '',
  projectId: urlParams.get('projectId') || '',
  storageBucket: urlParams.get('storageBucket') || '',
  messagingSenderId: urlParams.get('messagingSenderId') || '',
  appId: urlParams.get('appId') || ''
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// إشعار افتراضي بسيط لو الرسالة الجاية من السيرفر معندهاش "notification" جاهز
messaging.onBackgroundMessage(function(payload){
  const title = (payload.notification && payload.notification.title) || 'تذكير من ورشة الجلابيب';
  const body = (payload.notification && payload.notification.body) || 'عندك طلب قريب موعد تسليمه';
  const options = {
    body: body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

// لو المستخدم ضغط على الإشعار، افتح التطبيق (أو رجّع الفوكس لتاب مفتوح بالفعل)
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(clientList){
      for(const client of clientList){
        if('focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow('./');
    })
  );
});
