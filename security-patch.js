/* ============================================================
   security-patch.js - النسخة المُصلحة (v2)
   
   [v2] تم إصلاح المشكلة:
   - v1 كان يحاول الوصول لـ window.pin (لم يكن موجوداً) → فشل
   - v1 كان يشفر كلمة المرور → لا يمكن الدخول بعدها
   
   [v2] الآن:
   - يرجع كلمة المرور إلى 0000 تلقائياً إذا كانت مشفرة
   - لا يُشفر أي كلمة مرور
   - الإصلاحات الأخرى (PIN lockout، إلخ) في core-fixes.js
     تعمل كما هي بدون تغيير
   ============================================================ */

(function() {
  if (window.__securityPatchV2Loaded) return;
  window.__securityPatchV2Loaded = true;

  console.log('🔐 تحميل security-patch.js v2 (مُصلح)...');

  var STORAGE_KEY = 'jalaba_db_v1';
  var reverted = false;

  // إعادة كلمة المرور إلى 0000 إذا كانت مشفرة
  function fixHashedPassword() {
    if (reverted) return true;
    if (!window.db) return false;
    
    var pwd = window.db.password;
    var isHashed = typeof pwd === 'string' && 
                   (pwd.indexOf('sha256:') === 0 || pwd.indexOf('fallback:') === 0);
    
    if (!isHashed) {
      reverted = true;
      console.log('✅ كلمة المرور سليمة (نص عادي)');
      return true;
    }
    
    // كلمة المرور مشفرة → أرجعها
    console.log('🔄 كلمة المرور مشفرة — جاري الإصلاح...');
    
    window.db.password = '0000';
    window.db.managerPassword = null;
    window.db.receptionPassword = null;
    window.db.financePassword = null;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
      localStorage.removeItem('jalaba_passwords_migrated_v1');
      localStorage.removeItem('jalaba_pin_attempts_v1');
      localStorage.removeItem('jalaba_pin_lock_until_v1');
    } catch (e) {
      console.error('فشل الحفظ:', e);
    }
    
    reverted = true;
    console.log('✅ تم إصلاح كلمة المرور — الآن 0000');
    
    if (typeof window.toast === 'function') {
      window.toast('🔑 كلمة المرور الآن: 0000', 5000);
    }
    
    // إعادة تحميل الصفحة لتطبيق التغيير
    setTimeout(function() { location.reload(); }, 2000);
    
    return true;
  }

  // حاول فوراً، وكل 200ms، وأخيراً عند اكتمال التحميل
  fixHashedPassword();
  
  var tries = 0;
  var interval = setInterval(function() {
    tries++;
    if (fixHashedPassword() || tries > 50) {
      clearInterval(interval);
    }
  }, 200);

  window.addEventListener('load', function() {
    setTimeout(fixHashedPassword, 500);
  });

  // ⚠️ ملاحظة: لا نستبدل checkPin (الإصلاحات الأخرى كافية)
  // ✅ باقي الميزات تعمل بشكل طبيعي:
  //    - حماية PIN من القوة العمياء: في core-fixes.js
  //    - الحفظ الفوري: في core-fixes.js  
  //    - حفظ الصور: في core-fixes.js

  console.log('✅ security-patch.js v2 جاهز');
})();
