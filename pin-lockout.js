/* ============================================================
   pin-lockout.js — قفل مؤقت بعد محاولات الرقم السري الخاطئة
   ------------------------------------------------------------
   ✅ بيلفّ (wrap) دالة checkPin الموجودة في core.js — مش بيستبدلها:
      كل منطق الدخول (مالك/مدير/استقبال) والصلاحيات زي ما هو بالظبط.
   ✅ مش بيلمس db ولا بيانات التطبيق، ولا بيعمل أي حساب مالي.
   ✅ عدّاد المحاولات محفوظ في localStorage بمفتاح مستقل (يفضل بعد
      إعادة تحميل الصفحة، فمش ممكن تخطّيه بالـ Refresh).
   ✅ لحذفه: احذف سطر <script src="pin-lockout.js"> من index.html بس.

   القاعدة: ٥ محاولات غلط ⟵ إيقاف 30 ثانية، ١٠ ⟵ دقيقتين، ١٥ ⟵ ٥ دقايق.
   العدّاد بيتصفّر عند الدخول الصحيح، أو لو عدّى ١٥ دقيقة من آخر غلطة.
   ============================================================ */
(function () {
  if (window.__pinLockoutLoaded) return;
  window.__pinLockoutLoaded = true;

  var KEY = 'jalaba_pin_lockout_v1';
  var DECAY_MS = 15 * 60 * 1000;

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        return { fails: Number(s.fails) || 0, until: Number(s.until) || 0, last: Number(s.last) || 0 };
      }
    } catch (e) { /* تجاهل */ }
    return { fails: 0, until: 0, last: 0 };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* تجاهل */ } }
  function clearState() { try { localStorage.removeItem(KEY); } catch (e) { /* تجاهل */ } }

  function lockSeconds(fails) {
    if (fails >= 15) return 300;
    if (fails >= 10) return 120;
    if (fails >= 5) return 30;
    return 0;
  }
  function fmt(secs) {
    return secs >= 60 ? Math.ceil(secs / 60) + ' دقيقة' : secs + ' ثانية';
  }
  function showMsg(text) {
    var el = document.getElementById('lockError');
    if (el) el.textContent = text;
  }
  function resetPin() {
    window.pin = '';
    if (typeof window.updatePinDots === 'function') window.updatePinDots();
  }

  var orig = window.checkPin;
  if (typeof orig !== 'function' || orig.__pinLockWrapped) return;

  var wrapped = function () {
    var now = Date.now();
    var s = load();

    // لو عدّى وقت طويل من آخر غلطة ومفيش إيقاف سارٍ ⟵ نبدأ من الصفر
    if (s.last && now - s.last > DECAY_MS && s.until <= now) s = { fails: 0, until: 0, last: 0 };

    // إيقاف سارٍ ⟵ مانجرّبش الرقم أصلاً
    if (s.until > now) {
      resetPin();
      showMsg('⚠️ تم إيقاف الدخول مؤقتًا — انتظر ' + fmt(Math.ceil((s.until - now) / 1000)));
      return;
    }

    // لو الدالة الأصلية رمت خطأ (مثلاً من boot بعد الدخول) نحسب الحالة الأول ثم نعيد رمي نفس الخطأ — مانبلعوش أي خطأ
    var result;
    var thrown = null;
    try { result = orig.apply(this, arguments); } catch (e) { thrown = e; }

    var ls = document.getElementById('lockScreen');
    var unlocked = !!ls && ls.style.display === 'none';
    if (unlocked) {
      clearState();
      if (thrown) throw thrown;
      return result;
    }

    // محاولة فاشلة
    s.fails += 1;
    s.last = now;
    var secs = lockSeconds(s.fails);
    if (secs) s.until = now + secs * 1000;
    save(s);

    var msg = '';
    if (secs) msg = '⚠️ محاولات كثيرة خاطئة — تم إيقاف الدخول ' + fmt(secs);
    else if (s.fails >= 3) msg = 'الرقم السري غير صحيح — تبقّى ' + (5 - s.fails) + ' محاولات قبل الإيقاف المؤقت';
    if (msg) {
      showMsg(msg);
      // الدالة الأصلية بتمسح رسالة الخطأ بعد 420ms (updatePinDots) — نعيد عرض رسالتنا بعدها
      setTimeout(function () { showMsg(msg); }, 500);
    }
    if (thrown) throw thrown;
    return result;
  };
  wrapped.__pinLockWrapped = true;
  window.checkPin = wrapped;
})();
