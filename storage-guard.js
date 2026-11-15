/* ============================================================
   storage-guard.js — تنبيه امتلاء مساحة التخزين (بدل الفشل الصامت)
   ------------------------------------------------------------
   المشكلة: لو localStorage امتلى، flushSaveDB() في core.js بتبلع الخطأ وتكتب
   سطر في الكونسول بس — والتطبيق بيبان كأنه حفظ، وآخر تعديلاتك ممكن تضيع.

   الحل (من غير ما نغيّر أي سلوك ولا نحذف أي بيانات):
   ✅ بنلفّ flushSaveDB: لو الحفظ فشل ⟵ شريط أحمر ثابت فوق الصفحة فيه
      زر «💾 تصدير نسخة الآن» (بيستخدم exportBackup الموجودة، وبتشتغل
      حتى والتخزين ممتلئ لأنها من الذاكرة). لما الحفظ يرجع يشتغل الشريط بيختفي.
   ✅ تحذير مبكر (مرة في اليوم بحد أقصى) لو الاستهلاك قرّب من الحد.
   ✅ مش بيحذف ولا بيعدّل أي بيانات. لحذفه: احذف سطر <script src="storage-guard.js">.
   ============================================================ */
(function () {
  if (window.__storageGuardLoaded) return;
  window.__storageGuardLoaded = true;

  var BANNER_ID = 'storageGuardBanner';
  var SOFT_LIMIT_CHARS = 4200000;      // تقريباً 80% من حد localStorage (≈5.2 مليون حرف)
  var SOFT_KEY = 'jalaba_storage_soft_warn';
  var banner = null;

  function pendingNow() {
    // saveDBPending معرّفة بـ let في core.js — بنقراها كمتغيّر عام لو موجودة
    try { return typeof saveDBPending !== 'undefined' && saveDBPending === true; } catch (e) { return false; }
  }

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function showBanner() {
    if (banner && document.getElementById(BANNER_ID)) return;
    var bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#B71C1C;color:#fff;' +
      'padding:10px 12px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;' +
      'font-weight:700;font-size:14px;line-height:1.6;direction:rtl;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35)';
    var msg = document.createElement('span');
    msg.textContent = '⚠️ مساحة التخزين في المتصفح ممتلئة — آخر تعديلاتك غير محفوظة! صدّر نسخة احتياطية الآن قبل ما تقفل الصفحة.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '💾 تصدير نسخة الآن';
    btn.style.cssText = 'background:#fff;color:#B71C1C;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer';
    btn.addEventListener('click', function () {
      try { if (typeof window.exportBackup === 'function') window.exportBackup(); } catch (e) { console.warn(e); }
    });
    bar.appendChild(msg);
    bar.appendChild(btn);
    document.body.appendChild(bar);
    banner = bar;
  }

  function afterFlush() {
    if (pendingNow()) showBanner();
    else if (banner) {
      hideBanner();
      try { if (typeof window.toast === 'function') window.toast('✅ رجع الحفظ يشتغل عادي'); } catch (e) { /* تجاهل */ }
    }
  }

  // ---- لفّ flushSaveDB (نفس السلوك الأصلي + فحص النتيجة) ----
  var orig = window.flushSaveDB;
  if (typeof orig === 'function' && !orig.__guardWrapped) {
    var wrapped = function () {
      var result; var thrown = null;
      try { result = orig.apply(this, arguments); } catch (e) { thrown = e; }
      afterFlush();
      if (thrown) throw thrown;
      return result;
    };
    wrapped.__guardWrapped = true;
    window.flushSaveDB = wrapped;
  }

  // ---- تحذير مبكر: تقدير استهلاك localStorage (عدد الأحرف) ----
  function usedChars() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        n += k.length + (localStorage.getItem(k) || '').length;
      }
    } catch (e) { return 0; }
    return n;
  }
  function softCheck() {
    var used = usedChars();
    if (used < SOFT_LIMIT_CHARS) return false;
    var today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(SOFT_KEY) === today) return false; } catch (e) { /* تجاهل */ }
    try { localStorage.setItem(SOFT_KEY, today); } catch (e) { /* ممتلئ أصلاً: هنحذّر برضه */ }
    var pct = Math.min(99, Math.round(used / 5200000 * 100));
    if (typeof window.toast === 'function') {
      window.toast('💡 مساحة التخزين قرّبت تخلص (حوالي ' + pct + '% تقريباً). صدّر نسخة احتياطية، وراجع الصور القديمة لو كثيرة.');
    }
    return true;
  }
  window.__storageGuard = { softCheck: softCheck, usedChars: usedChars, afterFlush: afterFlush };

  setTimeout(softCheck, 20000);
  setInterval(softCheck, 30 * 60 * 1000);
})();
